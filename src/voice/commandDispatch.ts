import { delay } from "@/lib/utils"
import { abortChecklist, executeChecklist } from "@/services/checklistRunner"
import { executeFlow } from "@/services/flowRunner"
import { playSound, playSoundSequence } from "@/services/playSounds"
import { buildGoAroundAltSequence, buildPassingAltitudeSequence } from "@/services/soundSequences"
import { useGroundEngineerStore } from "@/store/groundEngineerStore"
import { usePassingAltitudeStore } from "@/store/passingAltitudeStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { usePreflightTimerStore } from "@/store/preflightTimerStore"
import { useRtoStore } from "@/store/rtoStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"

import { setEngAntiIce, setWingAntiIce } from "./commands/antiIce"
import { setAPUBleed, setStartAPU } from "./commands/apu"
import {
  setAirspeedDial,
  setAltitudeDial,
  setAPPR,
  setAutoPilot,
  setFlightDirector,
  setHeadingDial,
  setLOC,
  setLevelOff,
  setSelSpeed,
  setSelAlt,
  syncHeading,
  setHdgSel,
  setNav,
  setLVLCH
} from "./commands/autoPilot"
import { setStdBaro } from "./commands/baro"
import { setBrakeFan } from "./commands/brakeFan"
import { startEngine1, startEngine2, setIgnKnob } from "./commands/engine"
import { setFlaps } from "./commands/flaps"
import { flightControlsCheck, opencloseFCTLECAM } from "./commands/flightControlsCheck"
import { setGearHandle } from "./commands/gear"
import { executeGoAround } from "./commands/goAround"
import { callPushback, disconnectAllGround, setASU, setGPU } from "./commands/groundServices"
import { setLandingLights, setStrobeLights, setTaxiLights } from "./commands/lights"
import { setSeatBelts } from "./commands/seatBelts"
import { setWipers } from "./commands/wipers"

const randomDelay = (min: number, max: number) => delay(min + Math.random() * (max - min))

const gePack = () => useSettingsStore.getState().geSoundPack

// Commands that are allowed to fire even while a checklist is running.
export const CHECKLIST_ABORT_COMMANDS = new Set(["checklist_cancel"])

// Still work while the FO is on the walkaround: the ground engineer is someone else, and the timer drives the absence
export const FO_AWAY_ALLOWED_COMMANDS = new Set([
  "ground_call",
  "pushback_request",
  "connect_gpu",
  "disconnect_gpu",
  "connect_asu",
  "disconnect_asu",
  "disconnect_all_ground",
  "prepare_aircraft"
])

// ─── Discrete command map ─────────────────────────────────────────────────────

export const DISCRETE_COMMAND_MAP: Record<string, () => void | Promise<void>> = {
  // ── Gear ──────────────────────────────────────────────────────────────────
  gear_up: () => setGearHandle(0),
  gear_down: () => setGearHandle(1),

  // ── Flaps ─────────────────────────────────────────────────────────────────
  slats_ret: () => setFlaps(0),
  slats_ext_zero: () => setFlaps(1),
  flaps_15: () => setFlaps(2),
  flaps_20: () => setFlaps(3),
  flaps_40: () => setFlaps(4),
  go_around_flaps: () => executeGoAround(),

  // ── Lights ────────────────────────────────────────────────────────────────
  landing_lights_on: () => {
    playSound("check.ogg")
    setLandingLights(0)
  },
  landing_lights_off: () => {
    playSound("check.ogg")
    setLandingLights(2)
  },
  takeoff_lights_on: () => {
    playSound("check.ogg")
    setTaxiLights(0)
  },
  taxi_lights_on: () => {
    playSound("check.ogg")
    setTaxiLights(1)
  },
  taxi_lights_off: () => {
    playSound("check.ogg")
    setTaxiLights(2)
  },
  strobe_lights_on: () => {
    playSound("check.ogg")
    setStrobeLights(0)
  },
  strobe_lights_auto: () => {
    playSound("check.ogg")
    setStrobeLights(1)
  },
  strobe_lights_off: () => {
    playSound("check.ogg")
    setStrobeLights(2)
  },

  // ── Flight director & bird ────────────────────────────────────────────────
  flight_director_on: () => {
    playSound("check.ogg")
    setFlightDirector(1)
  },
  flight_director_off: () => {
    playSound("check.ogg")
    setFlightDirector(0)
  },
  // ── Autopilot  ──────────────────────────────────────────────
  autopilot_engage: () => {
    playSound("check.ogg")
    setAutoPilot(1)
  },
  autopilot_disconnect: () => setAutoPilot(0),

  // ── FCU knob commands ──────────────────────────────
  pull_heading: () => {
    playSound("check.ogg")
    setHdgSel(1)
  },
  push_heading: () => {
    playSound("check.ogg")
    syncHeading(1)
  },
  manage_nav: () => {
    playSound("check.ogg")
    setNav(1)
  },
  pull_altitude: () => {
    playSound("check.ogg")
    setSelAlt(1)
  },
  pull_speed: () => {
    playSound("check.ogg")
    setSelSpeed(1)
  },
  push_to_level_off: () => {
    playSound("check.ogg")
    setLevelOff(1)
  },
  arm_approach: () => {
    playSound("check.ogg")
    setAPPR(1)
  },
  arm_localizer: () => {
    playSound("check.ogg")
    setLOC(1)
  },
  lvlch: () => {
    playSound("check.ogg")
    setLVLCH(1)
  },
  set_runway_track: () => {
    const hdg = useTelemetryStore.getState().telemetry?.["arrRunwayHdg"]
    if (hdg != null && hdg >= 1 && hdg <= 360) {
      setHeadingDial(hdg)
    }
  },
  gd_speed: () => {
    const speed = useTelemetryStore.getState().telemetry?.["gdSpeed"]
    if (speed != null) {
      setAirspeedDial(speed)
    }
  },
  s_speed: () => {
    const speed = useTelemetryStore.getState().telemetry?.["sSpeed"]
    if (speed != null) {
      setAirspeedDial(speed)
    }
  },
  f_speed: () => {
    const speed = useTelemetryStore.getState().telemetry?.["fSpeed"]
    if (speed != null) {
      setAirspeedDial(speed)
    }
  },
  vapp: () => {
    const speed = useTelemetryStore.getState().telemetry?.["Vapp"]
    if (speed != null) {
      setAirspeedDial(speed)
    }
  },

  // ── Baro ──────────────────────────────────────────────────────────────────
  set_standard: () => {
    const t = useTelemetryStore.getState().telemetry
    const passingAlt = usePassingAltitudeStore.getState()

    setStdBaro(1)

    // Only trigger passing altitude callout if:
    // - Airborne
    // - Climbing (VS > 100 fpm)
    // - Not already tracking a passing altitude
    if (t && !t.onGround && t.vs > 100 && !passingAlt.isTracking()) {
      const targetAlt = t.pAlt + t.vs * (9 / 60)

      // Play "standard crosschecked, passing FL XXX" sequence
      const sequence = buildPassingAltitudeSequence(targetAlt)
      playSoundSequence(sequence)

      // Store target for "now" callout detection
      passingAlt.setTarget(targetAlt)
    }
  },

  // ── APU ───────────────────────────────────────────────────────────────────
  apu_start: () => {
    playSound("check.ogg")
    setStartAPU(1)
  },

  apu_bleed_on: () => {
    playSound("check.ogg")
    setAPUBleed(1)
  },

  apu_bleed_off: () => {
    playSound("check.ogg")
    setAPUBleed(0)
  },

  // ── Anti-ice ──────────────────────────────────────────────────────────────
  engine_anti_ice_on: () => {
    playSound("check.ogg")
    setEngAntiIce(1)
  },
  engine_anti_ice_off: () => {
    playSound("check.ogg")
    setEngAntiIce(0)
  },
  wing_anti_ice_on: () => {
    playSound("check.ogg")
    setWingAntiIce(1)
  },
  wing_anti_ice_off: () => {
    playSound("check.ogg")
    setWingAntiIce(0)
  },

  // ── Seat belts ────────────────────────────────────────────────────────────
  seat_belts_on: () => {
    playSound("check.ogg")
    setSeatBelts(1)
  },
  seat_belts_off: () => {
    playSound("check.ogg")
    setSeatBelts(0)
  },

  // ── Wipers ────────────────────────────────────────────────────────────────
  wipers_off: () => setWipers(0),
  wipers_slow: () => setWipers(1),
  wipers_fast: () => setWipers(2),

  // ── Brake check ───────────────────────────────────────────────────────────
  brake_check: () => playSound("pressure_zero.ogg"),

  // ── Brake Fan ─────────────────────────────────────────────────────────────
  brake_fan_on: async () => {
    playSound("check.ogg")
    await setBrakeFan(true)
  },

  brake_fan_off: async () => {
    playSound("check.ogg")
    await setBrakeFan(false)
  },

  // ── Flight controls ───────────────────────────────────────────────────────
  flight_controls_check: async () => {
    await opencloseFCTLECAM(1)
    await delay(1000)
    await playSound("ready.ogg")
    await flightControlsCheck()
  },

  // ── Preflight timer ───────────────────────────────────────────────────────
  prepare_aircraft: () => usePreflightTimerStore.getState().start(),

  // ── Engine start ──────────────────────────────────────────────────────────
  engine_start_2: async () => {
    await playSound("check.ogg")
    const startAB = Math.random() < 0.5 ? 0 : 1
    await setIgnKnob(startAB)
    await delay(2000)
    await startEngine2(1)
  },
  engine_start_1: async () => {
    await playSound("check.ogg")
    await startEngine1(1)
  },

  // ── Flows ─────────────────────────────────────────────────────────────────
  clear_left: () => executeFlow("clear_left"),
  runway_entry_procedure: () => executeFlow("before_takeoff"),
  clear_for_takeoff: () => executeFlow("takeoff"),
  before_start_procedure: () => executeFlow("before_start"),
  des_prep: () => executeFlow("des_prep"),
  secure_aircraft: () => executeFlow("secure"),

  // ── Checklists ────────────────────────────────────────────────────────────
  checklist_before_start_p1: () => executeChecklist("before_start_to_the_line"),
  checklist_before_start_p2: () => executeChecklist("before_start_below_the_line"),
  checklist_after_start: () => executeChecklist("after_start"),
  checklist_before_takeoff_p1: () => executeChecklist("before_takeoff_to_the_line"),
  checklist_before_takeoff_p2: () => executeChecklist("before_takeoff_below_the_line"),
  checklist_after_takeoff_p1: () => executeChecklist("climb_to_the_line"),
  checklist_after_takeoff_p2: () => executeChecklist("climb_below_the_line"),
  checklist_after_landing: () => executeChecklist("after_landing"),
  checklist_approach: () => executeChecklist("approach"),
  checklist_landing: () => executeChecklist("landing"),
  checklist_parking: () => executeChecklist("parking"),
  checklist_secure: () => executeChecklist("secure"),
  checklist_cancel: () => abortChecklist(),

  // ── RTO / Continue  ─────────────────────────────────────
  abort_takeoff: () => useRtoStore.getState().trigger(),
  continue: () => playSound("check.ogg"),

  // ── Control handover ──────────────────────────────────────────────────────
  you_have_ctrl: () => {
    playSound("i_have_ctrl.ogg")
  },
  i_have_ctrl: () => {
    playSound("you_have_ctrl.ogg")
  },

  // ── Ground engineer ───────────────────────────────────────────────────────
  pushback_request: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await callPushback()
  },
  ground_call: async () => {
    await randomDelay(2000, 6000)
    await playSound("go_ahead.ogg", { pack: gePack() })
    useGroundEngineerStore.getState().activate()
  },
  connect_gpu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setGPU(true)
    await playSound("gpu_on.ogg", { pack: gePack() })
  },
  disconnect_gpu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setGPU(false)
    await playSound("gpu_off.ogg", { pack: gePack() })
  },
  connect_asu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setASU(true)
    await playSound("asu_on.ogg", { pack: gePack() })
  },
  disconnect_asu: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(3000, 8000)
    await setASU(false)
    await playSound("asu_off.ogg", { pack: gePack() })
  },
  disconnect_all_ground: async () => {
    if (!useGroundEngineerStore.getState().isActive) return
    useGroundEngineerStore.getState().deactivate()
    await randomDelay(5000, 12000)
    await disconnectAllGround()
    await playSound("gpu_off.ogg", { pack: gePack() })
  }
}

// ─── FO command dispatcher (heading, altitude, speed, fma) ────────

export async function dispatchFoCommand(commandType: string, payload: Record<string, unknown>): Promise<boolean> {
  const verb = (payload.verb as string | undefined) ?? "set"
  const isPull = verb === "pull"

  switch (commandType) {
    case "discrete": {
      const cmd = payload.command as string | undefined
      if (!cmd) return false
      const handler = DISCRETE_COMMAND_MAP[cmd]
      if (!handler) return false
      await handler()
      return true
    }

    case "heading": {
      const value = payload.value as number
      if (isPull) {
        setHdgSel(1)
        await delay(500)
      }
      setHeadingDial(value)

      return true
    }

    case "altitude": {
      const feet = payload.flightLevel != null ? (payload.flightLevel as number) * 100 : (payload.value as number)
      if (isPull) {
        setSelAlt(1)
        await delay(500)
      }
      playSound("check.ogg")
      setAltitudeDial(feet)
      return true
    }

    case "speed": {
      const value = payload.value as number
      if (isPull) {
        setSelSpeed(1)
        await delay(500)
      }
      setAirspeedDial(value)
      return true
    }

    case "fma_callout": {
      playSound("check.ogg")
      return true
    }

    case "missed_approach_altitude": {
      // Grammar pid 16 ("auto") carries the string "AUTO" and is resolved by the
      // sidecar to payload.mode = "auto"; pids 17/18 carry the spoken value.
      const altValue =
        (payload.mode as string) === "auto"
          ? usePerformanceStore.getState().landing.missedAltitude
          : (payload.value as number | undefined)
      if (altValue == null) return true
      setAltitudeDial(altValue)
      playSoundSequence(buildGoAroundAltSequence(altValue))
      return true
    }

    default:
      return false
  }
}
