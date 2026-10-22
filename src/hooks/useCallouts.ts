import { useEffect, useRef } from "react"

import { simvarSet } from "@/API/simvarApi"
import { useTelemetryTick } from "@/hooks/useTelemetryTick"
import { playSound, isSoundPlaying, playSoundSequence } from "@/services/playSounds"
import { useGoAroundStore } from "@/store/goAroundStore"
import { usePassingAltitudeStore } from "@/store/passingAltitudeStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { useRtoStore } from "@/store/rtoStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

type LandingPhase = "idle" | "spoilers" | "reverser" | "decel"

interface SpeedCalloutFlags {
  calledThrustSet: boolean
  called100: boolean
  called80: boolean
  calledVr: boolean
  calledV1: boolean
  vrInhibit: boolean
  v1Inhibit: boolean
}

interface AltitudeCalloutFlags {
  positiveClimb: boolean
  tenThousandClimb: boolean
  tenThousandDescent: boolean
  transitionAltitude: boolean
  transitionLevel: boolean
  above100mda: boolean
  above100dh: boolean
  minimum: boolean
  oneToGo: boolean
  gsalive: boolean
}

interface LandingSequenceState {
  wasAirborne: boolean
  phase: LandingPhase
  phaseStartTime: number | null
  done: boolean
}

interface RtoState {
  active: boolean
  startedAt: number | null
  calledReverse: boolean
  calledDecel: boolean
}

interface PreviousValues {
  speed: number
  alt: number
  radioAlt: number
  onGround: number
  takeoffN1: number
  fcuAlt: number
}

// ─── Approach deviation calls ────────────────────────────────────────────────
// FCOM PRO-NOR-SCO "Flight parameters, approach"; re-armed at most every 5 s so a value on the limit doesn't chatter

type DeviationCall = "speed" | "sinkRate" | "bank" | "pitch" | "loc" | "glide"

const DEVIATION_MIN_RA = 50
const DEVIATION_MAX_RA = 1000
const DEVIATION_REARM_MS = 5000

const DEVIATION_SOUNDS: Record<DeviationCall, string> = {
  speed: "speed.ogg",
  sinkRate: "sink_rate.ogg",
  bank: "bank.ogg",
  pitch: "pitch.ogg",
  loc: "loc.ogg",
  glide: "glide.ogg"
}

function exceededDeviations(t: Telemetry): Record<DeviationCall, boolean> {
  const pitchUp = -t.pitchDegrees
  const locOk = t.locValid > 0.5
  const gsOk = t.glideValid > 0.5
  return {
    speed: t.speedTarget > 0 && (t.ias < t.speedTarget - 5 || t.ias > t.speedTarget + 10),
    sinkRate: t.vs < -1000,
    bank: Math.abs(t.bankDegrees) > 7,
    pitch: pitchUp > 10 || pitchUp < 0,
    loc: locOk && Math.abs(t.locDeviation) > 0.25,
    glide: gsOk && Math.abs(t.glideDeviation) > 1
  }
}

const newDeviationState = (): Record<DeviationCall, number | null> => ({
  speed: null,
  sinkRate: null,
  bank: null,
  pitch: null,
  loc: null,
  glide: null
})

const THRUST_SET_MARGIN = 1

const getTakeoffThrustTarget = (t: Telemetry) => {
  // A310 TRP_MODE: 5 = TOGA, 6 = FLEX
  if (t.thrustRatingMode === 6) {
    // FLEX mode - use flex thrust if flex temp is set (>1)
    return (t.iniFlexTemperature ?? 0) > 1 ? (t.iniThrustFlexN1 ?? 0) : (t.iniThrustTogaN1 ?? 0)
  }
  // TOGA mode (5) or unknown mode
  return t.iniThrustTogaN1 ?? 0
}

const crossedUp = (prev: number, curr: number, threshold: number) => prev < threshold && curr >= threshold

const crossedDown = (prev: number, curr: number, threshold: number) => prev > threshold && curr <= threshold

const advancePhase = (ls: LandingSequenceState, next: LandingPhase, now: number) => {
  ls.phase = next
  ls.phaseStartTime = now
}

const completeLanding = (ls: LandingSequenceState) => {
  ls.phase = "idle"
  ls.phaseStartTime = null
  ls.done = true
}

const resetLanding = (ls: LandingSequenceState) => {
  ls.phase = "idle"
  ls.phaseStartTime = null
  ls.done = false
}

// ─── Landing phase handlers ──────────────────────────────────────────────────

const SPOILER_TIMEOUT = 3000
const REVERSER_TIMEOUT = 3000
const DECEL_TIMEOUT = 10000

function handleSpoilersPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) {
  if (t.spoilersHandlePosition > 0.1) {
    playSound("spoilers.ogg")
    advancePhase(ls, "reverser", now)
  } else if (elapsed >= SPOILER_TIMEOUT) {
    playSound("no_spoilers.ogg")
    advancePhase(ls, "reverser", now)
  }
}

function handleReverserPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) {
  if (t.engine1Reverse > 0.1 || t.engine2Reverse > 0.1) {
    playSound("reverse_green.ogg")
    advancePhase(ls, "decel", now)
  } else if (elapsed >= REVERSER_TIMEOUT) {
    playSound("no_reverse_engine_1_and_2.ogg")
    advancePhase(ls, "decel", now)
  }
}

function handleDecelPhase(ls: LandingSequenceState, t: Telemetry, elapsed: number) {
  const brakesApplied = t.brakeLeftPosition > 0.1 || t.brakeRightPosition > 0.1
  if (brakesApplied && t.ias > 40) {
    completeLanding(ls)
  } else if (elapsed >= DECEL_TIMEOUT) {
    completeLanding(ls)
  }
}

const PHASE_HANDLERS: Record<
  Exclude<LandingPhase, "idle">,
  (ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) => void
> = {
  spoilers: handleSpoilersPhase,
  reverser: handleReverserPhase,
  decel: handleDecelPhase
}

// ─── Rejected takeoff ──────────────────────────────────────────────────────────
// Triggered by the pilot calling "stop". FCOM PRO-ABN-ABN-00: the F/O calls
// REVERSE GREEN, then DECEL or NO DECEL. There is no spoilers call, and nothing
// is said about reverse when it was never selected.

const RTO_ARM_MIN_IAS = 40
const RTO_END_IAS = 30
const RTO_DECEL_TIMEOUT = 5000

const resetRto = (rto: RtoState) => {
  rto.active = false
  rto.startedAt = null
  rto.calledReverse = false
  rto.calledDecel = false
}

function handleRto(rto: RtoState, t: Telemetry, prevSpeed: number, now: number) {
  if (!rto.calledReverse && (t.engine1Reverse > 0.1 || t.engine2Reverse > 0.1)) {
    playSound("reverse_green.ogg")
    rto.calledReverse = true
    return
  }

  if (rto.calledDecel) return

  const brakesApplied = t.brakeLeftPosition > 0.1 || t.brakeRightPosition > 0.1
  const elapsed = rto.startedAt ? now - rto.startedAt : 0

  if (brakesApplied && t.ias < prevSpeed) {
    playSound("decel.ogg")
    rto.calledDecel = true
  } else if (elapsed >= RTO_DECEL_TIMEOUT) {
    playSound("no_decel.ogg")
    rto.calledDecel = true
  }
}

export function useCallouts() {
  const speed = useRef<SpeedCalloutFlags>({
    calledThrustSet: false,
    called100: false,
    called80: false,
    calledVr: false,
    calledV1: false,
    vrInhibit: true,
    v1Inhibit: true
  })

  const altitude = useRef<AltitudeCalloutFlags>({
    positiveClimb: false,
    tenThousandClimb: false,
    tenThousandDescent: false,
    transitionAltitude: false,
    transitionLevel: false,
    above100mda: false,
    above100dh: false,
    minimum: false,
    oneToGo: false,
    gsalive: false
  })

  const landing = useRef<LandingSequenceState>({
    wasAirborne: false,
    phase: "idle",
    phaseStartTime: null,
    done: false
  })

  const prev = useRef<PreviousValues>({
    speed: 0,
    alt: 0,
    radioAlt: 0,
    onGround: 1,
    takeoffN1: 0,
    fcuAlt: 0
  })

  const thrustSetPrimed = useRef(false)

  // When each deviation call last played, or null while it is armed
  const deviationCalledAt = useRef(newDeviationState())
  // Takeoff and go-around pitch and climb would trip the approach limits, so the calls wait until the next approach
  const deviationInhibited = useRef(false)

  // Re-arm positive-climb callout on go-around
  const goAroundCount = useRef(useGoAroundStore.getState().count)
  useEffect(() => {
    return useGoAroundStore.subscribe((s) => {
      if (s.count !== goAroundCount.current) {
        goAroundCount.current = s.count
        altitude.current.positiveClimb = false
        deviationInhibited.current = true
      }
    })
  }, [])

  // Rejected takeoff: armed only by the pilot calling "stop", and only on the
  // ground above 40 kt so a stray call at the gate or in the cruise does nothing
  const rto = useRef<RtoState>({
    active: false,
    startedAt: null,
    calledReverse: false,
    calledDecel: false
  })

  const rtoCount = useRef(useRtoStore.getState().count)
  useEffect(() => {
    return useRtoStore.subscribe((s) => {
      if (s.count === rtoCount.current) return
      rtoCount.current = s.count

      const t = useTelemetryStore.getState().telemetry
      if (!t || !t.onGround || t.ias <= RTO_ARM_MIN_IAS) return

      resetRto(rto.current)
      rto.current.active = true
      rto.current.startedAt = Date.now()
    })
  }, [])

  const tick = async () => {
    const t = useTelemetryStore.getState().telemetry
    if (!t || t.isSlewActive) return

    const perf = usePerformanceStore.getState()
    const transitionAltitude = perf.takeoff.transitionAltitude
    const transitionLevel = perf.landing.transitionLevel
    const sp = speed.current
    const al = altitude.current
    const ls = landing.current
    const p = prev.current
    const v1 = t.v1 ?? 0
    const vr = t.vr ?? 0
    const now = Date.now()
    const takeoffN1 = Math.min(t.engine1N1 ?? 0, t.engine2N1 ?? 0)
    const fcuAlt = t.fcuAlt ?? 0
    const takeoffThrustTarget = getTakeoffThrustTarget(t)
    const mda = t.mda ?? 0
    const dh = t.dh ?? 0
    const isCat3B = dh === 0 && mda === 0

    if (!thrustSetPrimed.current) {
      thrustSetPrimed.current = true
      p.takeoffN1 = takeoffN1
    }

    // Re-arm one-to-go when FCU altitude changes
    if (fcuAlt !== p.fcuAlt) {
      al.oneToGo = false
    }

    // Takeoff / landing edge detection
    if (!t.onGround && p.onGround) {
      sp.called100 = false
      sp.vrInhibit = true
      sp.v1Inhibit = true
      al.positiveClimb = false
      al.tenThousandClimb = false
      al.transitionAltitude = false
      al.oneToGo = false
    }

    if (t.onGround && !p.onGround) {
      sp.called80 = false
      sp.vrInhibit = true
      sp.v1Inhibit = true
      al.tenThousandDescent = false
      al.transitionLevel = false
      al.oneToGo = false
      al.above100mda = false
      al.above100dh = false
      al.gsalive = false
    }

    // V1 callout logic
    if (t.onGround && !sp.v1Inhibit && v1 > 0 && t.ias >= v1 && t.ias < v1 + 5 && !sp.calledV1) {
      sp.calledV1 = true
      sp.v1Inhibit = true
      if (vr > 0 && Math.abs(vr - v1) <= 1) {
        playSoundSequence(["v_one.ogg", "rotate.ogg"])
        sp.calledVr = true
        sp.vrInhibit = true
      } else {
        playSound("v_one.ogg")
      }
    }

    // VR callout logic
    if (t.onGround && !sp.vrInhibit && vr > 0 && t.ias >= vr && t.ias < vr + 5 && !sp.calledVr && sp.calledV1) {
      playSound("rotate.ogg")
      sp.calledVr = true
      sp.vrInhibit = true
    }

    // 100 knots callout
    if (t.onGround && crossedUp(p.speed, t.ias, 100) && !sp.called100) {
      playSound("100_knots.ogg")
      sp.called100 = true
    }

    // 80 knots callout
    if (t.onGround && crossedDown(p.speed, t.ias, 80) && !sp.called80) {
      playSound("80_knots.ogg")
      sp.called80 = true
      setTimeout(() => {
        if (useSettingsStore.getState().postLandingShutdownEnabled) {
          void simvarSet("1 (>L:A300DR_CHRONO_START_BUTTON_FO)")
        }
      }, 5000)
    }

    // Thrust set callout
    if (
      t.onGround &&
      t.ias < 80 &&
      takeoffThrustTarget > 0 &&
      p.takeoffN1 < takeoffThrustTarget - THRUST_SET_MARGIN &&
      takeoffN1 >= takeoffThrustTarget - THRUST_SET_MARGIN &&
      !sp.calledThrustSet
    ) {
      playSound("thrust_set.ogg")
      sp.calledThrustSet = true
    }

    // Positive climb
    if (!t.onGround && t.vs > 120 && t.radioAlt > 30 && !al.positiveClimb) {
      playSound("positive_climb.ogg")
      al.positiveClimb = true
    }

    // Ten thousand feet
    if (!t.onGround && t.vs > 100 && !al.tenThousandClimb && crossedUp(p.alt, t.alt, 10000)) {
      playSound(transitionAltitude < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandClimb = true
    }

    if (!t.onGround && t.vs < -100 && !al.tenThousandDescent && crossedDown(p.alt, t.alt, 10000)) {
      playSound(transitionLevel < 10000 ? "fl_100.ogg" : "ten_thousand.ogg")
      al.tenThousandDescent = true
    }

    if (!t.onGround && t.glideDeviation < 2 && t.glideValid && !al.gsalive) {
      playSound("gs_alive.ogg")
      al.gsalive = true
    }

    // One to go
    if (!t.onGround && t.vs > 100 && !al.oneToGo && fcuAlt > 0 && crossedUp(p.alt, t.alt, fcuAlt - 1000)) {
      playSound("one_to_go.ogg")
      al.oneToGo = true
    }

    if (!t.onGround && t.vs < -100 && !al.oneToGo && fcuAlt > 0 && crossedDown(p.alt, t.alt, fcuAlt + 1000)) {
      playSound("one_to_go.ogg")
      al.oneToGo = true
    }

    if (!t.onGround && !isCat3B) {
      // 1. MDA triggers: ONLY if mda is set (>0) and dh is not
      if (mda > 0 && dh === 0 && t.alt <= mda + 100 && !al.above100mda) {
        playSound("100_above.ogg")
        al.above100mda = true
      }

      if (mda > 0 && dh === 0 && !al.minimum) {
        if (t.alt <= mda) {
          playSound("minimum.ogg")
          al.minimum = true
        }
      }

      // 3. DH trigger: ONLY if dh is set (>0)
      if (dh > 0 && t.radioAlt <= dh + 100 && !al.above100dh) {
        playSound("100_above.ogg")
        al.above100dh = true
      }
    }

    // Transition altitude / level
    if (
      !t.onGround &&
      t.vs > 100 &&
      !al.transitionAltitude &&
      transitionAltitude > 0 &&
      crossedUp(p.alt, t.alt, transitionAltitude)
    ) {
      playSound("transiton_altitude.ogg")
      al.transitionAltitude = true
    }

    if (
      !t.onGround &&
      t.vs < -100 &&
      !al.transitionLevel &&
      transitionLevel > 0 &&
      crossedDown(p.alt, t.alt, transitionLevel)
    ) {
      playSound("transiton_level.ogg")
      al.transitionLevel = true
    }

    // Passing altitude "now" callout
    const passingAltStore = usePassingAltitudeStore.getState()
    if (passingAltStore.targetAltitude !== null && !passingAltStore.hasCalled) {
      // Check BOTH indicated and pressure altitude (use whichever is higher after setting standard)
      const altReached = t.alt >= passingAltStore.targetAltitude
      const pAltReached = t.pAlt >= passingAltStore.targetAltitude

      if (altReached || pAltReached) {
        playSound("now_at.ogg")
        passingAltStore.markCalled()
        // Clear state
        setTimeout(() => {
          passingAltStore.reset()
        }, 500)
      }
    }

    // Re-arm at taxi speed
    if (t.onGround && t.ias < 30) {
      sp.calledThrustSet = false
      sp.calledV1 = false
      sp.calledVr = false
      sp.called100 = false
      sp.vrInhibit = false
      sp.v1Inhibit = false
      // Reset passing altitude state
      usePassingAltitudeStore.getState().reset()
    }

    // Approach deviation calls
    if (t.onGround) deviationInhibited.current = true
    else if (t.radioAlt > DEVIATION_MAX_RA) deviationInhibited.current = false

    const inDeviationWindow =
      useSettingsStore.getState().deviationCallsEnabled &&
      !deviationInhibited.current &&
      !t.onGround &&
      t.landingGear > 0.5 &&
      t.radioAlt >= DEVIATION_MIN_RA &&
      t.radioAlt <= DEVIATION_MAX_RA

    if (inDeviationWindow) {
      const exceeded = exceededDeviations(t)
      const calledAt = deviationCalledAt.current
      const pending = (Object.keys(exceeded) as DeviationCall[]).filter((call) => {
        if (!exceeded[call]) {
          if (calledAt[call] !== null && now - calledAt[call] >= DEVIATION_REARM_MS) calledAt[call] = null
          return false
        }
        return calledAt[call] === null
      })

      // One call per tick so they never talk over each other or the other callouts
      if (pending.length > 0 && !(await isSoundPlaying())) {
        playSound(DEVIATION_SOUNDS[pending[0]])
        calledAt[pending[0]] = now
      }
    } else {
      deviationCalledAt.current = newDeviationState()
    }

    // Landing sequence

    // Height rather than a climb, so a flight started on approach still arms; a bounce stays below 100 ft
    if (!t.onGround && t.radioAlt > 100) {
      ls.wasAirborne = true
    }

    // Arm: landing (was airborne → now on ground)
    if (t.onGround && ls.wasAirborne && ls.phase === "idle" && !ls.done) {
      advancePhase(ls, "spoilers", now)
      ls.wasAirborne = false
    }

    // Rejected takeoff - runs on its own state, the landing sequence is untouched
    if (rto.current.active) {
      if (!t.onGround || t.ias < RTO_END_IAS) {
        resetRto(rto.current)
      } else if (!(await isSoundPlaying())) {
        handleRto(rto.current, t, p.speed, now)
      }
    }

    // Reset on sustained climb-away
    if (!t.onGround && t.vs > 500) {
      // Only reset passing altitude on actual go-around (landing sequence was active)
      if (ls.phase !== "idle" || ls.done) {
        usePassingAltitudeStore.getState().reset()
      }
      resetLanding(ls)
      ls.wasAirborne = false
    }

    // Reset on taxi
    if (t.onGround && t.ias < 30) {
      resetLanding(ls)
    }

    // Process landing phases (skip if idle or audio still playing)
    if (ls.phase !== "idle" && !(await isSoundPlaying())) {
      const elapsed = ls.phaseStartTime ? now - ls.phaseStartTime : 0
      const handler = (
        PHASE_HANDLERS as Record<string, (ls: LandingSequenceState, t: Telemetry, elapsed: number, now: number) => void>
      )[ls.phase]
      if (typeof handler === "function") {
        handler(ls, t, elapsed, now)
      } else {
        console.warn(`[useCallouts] Unknown landing phase: ${ls.phase}`)
        // Reset landing sequence to avoid repeated errors
        resetLanding(ls)
      }
    }

    // Update previous values
    p.speed = t.ias
    p.alt = t.alt
    p.radioAlt = t.radioAlt
    p.onGround = t.onGround
    p.takeoffN1 = takeoffN1
    p.fcuAlt = fcuAlt
  }

  useTelemetryTick(tick)
}
