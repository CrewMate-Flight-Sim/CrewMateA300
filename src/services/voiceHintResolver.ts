import { getA300Variant } from "@/services/a300Variant"
import { usePerformanceStore } from "@/store/performanceStore"
import type { Telemetry } from "@/store/telemetryStore"

// Result for VoiceGuide UI — phrases must match CopilotSpeech grammar
export type VoiceHintPhase = {
  id: string
  title: string
  phrases: string[]
}

const N1_IDLE_MAX = 15
const TAXI_MAX_IAS = 45
const LINEUP_MAX_IAS = 60

// Airborne phase thresholds

function num(t: Telemetry | null, key: string): number | null {
  if (!t) return null
  const v = t[key]
  return typeof v === "number" ? v : null
}

function isOnGround(t: Telemetry | null): boolean {
  const g = num(t, "onGround")
  return g !== null && g > 0.5
}

function enginesOff(t: Telemetry | null): boolean {
  const m1 = num(t, "mixture1") ?? 1
  const m2 = num(t, "mixture2") ?? 1
  const n1 = num(t, "engine1N1") ?? 0
  const n2 = num(t, "engine2N1") ?? 0
  return m1 < 0.5 && m2 < 0.5 && n1 < N1_IDLE_MAX && n2 < N1_IDLE_MAX
}

export type ResolveVoiceHintsArgs = {
  telemetry: Telemetry | null
  lastCompletedChecklistId: string | null
  lastCompletedFlowId: string | null
  voiceChecklistRunning: boolean
  preflightTimerRunning: boolean
}

/**
 * Ground phases progress through the typical SOP flow using lastCompleted* milestones
 * so hints stay relevant without requiring manual phase selection.
 */
export function resolveVoiceHints(args: ResolveVoiceHintsArgs): VoiceHintPhase | null {
  const {
    telemetry: t,
    lastCompletedChecklistId: lastCl,
    lastCompletedFlowId: lastFl,
    voiceChecklistRunning,
    preflightTimerRunning
  } = args

  if (voiceChecklistRunning) return null
  if (!t) return null

  const ias = num(t, "ias") ?? 0
  const vs = num(t, "vs") ?? 0
  const alt = num(t, "alt") ?? 0
  const flapsIndex = num(t, "flapsIndex") ?? 0
  const ground = isOnGround(t)
  const engOff = enginesOff(t)
  const landingGear = num(t, "landingGear") ?? 0
  const transitionAltitude = num(t, "transitionAltitude") ?? 5000
  const transitionLevel = usePerformanceStore.getState().landing.transitionLevel || 5000
  const onStandard = num(t, "baroMode") === 1
  const seatBelts = num(t, "seatBelts") ?? 0
  const v1 = num(t, "v1") ?? 0
  const beforeV1 = v1 ? ias < v1 : ias <= 100

  // ── AIRBORNE ────────────────────────────────────────────────────────────────
  if (!ground) {
    const descending = vs < -300
    const aboveTA = alt > transitionAltitude
    const above10k = alt > 10000

    const climbing = vs > 300
    const inDescentContext =
      !climbing && (descending || lastFl?.startsWith("desc_") || lastCl === "approach" || lastCl === "landing")

    if (!inDescentContext) {
      // Initial climb — flaps out
      if (flapsIndex > 0) {
        return {
          id: "initial_climb",
          title: "Initial climb",
          phrases: ["gear up", "flaps X", "slats retract", "autopilot on"]
        }
      }

      // To the line — flow done, flaps clean, still below TA
      if (flapsIndex === 0 && !aboveTA && lastFl === "both_packs" && lastCl !== "climb_to_the_line") {
        return {
          id: "after_takeoff_to_line",
          title: "After takeoff climb",
          phrases: ["after takeoff climb checklist to the line"]
        }
      }

      // Below the line — above TA
      if (aboveTA) {
        const phrases: string[] = []
        if (lastCl !== "climb_below_the_line") phrases.push("after takeoff climb checklist below the line")
        if (!onStandard) phrases.push("pull standard")
        if (above10k) {
          if (seatBelts) phrases.push("seatbelts off")
          if (lastCl === "climb_below_the_line")
            phrases.push("set landing elevation", "you have control", "i have control")
        }
        return {
          id: "after_takeoff_below_line",
          title: "After takeoff climb",
          phrases
        }
      }

      // Above 10k but below TA — seatbelts off only
      if (above10k) {
        const phrases: string[] = []
        if (seatBelts) phrases.push("seatbelts off")
        return {
          id: "climb_cruise",
          title: "Climb / cruise",
          phrases
        }
      }
    }

    // Approach config — below threshold, gear not down, and either descending or
    // recovering from a go-around (climbing after the approach/landing checklist).
    // The go-around term is required: without it, level cruise below the TA with
    // no milestones would spuriously emit approach/gear-down hints.
    const approachThreshold = Math.min(10000, transitionLevel)
    const inClimbContext =
      lastFl === "both_packs" || lastCl === "climb_to_the_line" || lastCl === "climb_below_the_line"
    const goAroundContext = climbing && (lastCl === "approach" || lastCl === "landing")
    if (!inClimbContext && (inDescentContext || goAroundContext) && alt <= approachThreshold && landingGear !== 1) {
      const phrases: string[] = ["gear down", "flaps X", "slats extend"]
      if (lastCl !== "approach" && lastCl !== "landing") phrases.unshift("approach checklist")
      return {
        id: "approach_items",
        title: "Approach",
        phrases
      }
    }

    // Short final — gear down, flaps out, approach checklist done
    if (lastCl == "approach" && landingGear == 1 && flapsIndex >= 2) {
      return {
        id: "short_final1",
        title: "Short final",
        phrases: ["flaps fourty", "landing checklist", "go around flaps", "continue"]
      }
    }

    if (lastCl == "landing" && landingGear == 1 && flapsIndex >= 2) {
      return {
        id: "short_final2",
        title: "Short final",
        phrases: ["go around flaps", "continue"]
      }
    }

    return null
  }

  // ── GROUND ──────────────────────────────────────────────────────────────────
  //
  // Milestone chain (first match wins — ordered by latest SOP milestone)
  //
  const slowGround = ias <= LINEUP_MAX_IAS

  if (lastFl === "shutdown") {
    const isCargo = getA300Variant() === "cargo"
    const disarmSlides = isCargo ? "disarm slides" : "cabin crew disarm slides"
    return {
      id: "parking",
      title: "Parking",
      phrases: [disarmSlides, "parking checklist"]
    }
  }

  // After the after_landing flow has completed → show after-landing hints (on ground)
  if (lastFl === "after_landing" && lastCl !== "after_landing" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_landing_hints",
      title: "After landing",
      phrases: ["after landing checklist", "start the apu", "taxi lights off"]
    }
  }

  if (lastFl === "after_landing" && lastCl === "after_landing" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_landing_hints",
      title: "After landing",
      phrases: ["start the apu", "taxi lights off"]
    }
  }

  // After takeoff flow → thrust setting + stop
  if (lastFl === "takeoff" && slowGround) {
    return {
      id: "takeoff_thrust",
      title: "Takeoff",
      phrases: ["thrust srs heading", "thrust srs runway", "stop"]
    }
  }

  if (lastFl === "takeoff" && ground && beforeV1) {
    return {
      id: "takeoff_thrust2",
      title: "Takeoff",
      phrases: ["stop"]
    }
  }

  // After line_up checklist → say "takeoff" to start takeoff flow
  if (lastCl === "before_takeoff_below_the_line" && slowGround) {
    return {
      id: "call_takeoff",
      title: "Takeoff",
      phrases: ["takeoff"]
    }
  }

  // After before_takeoff (line up) flow → call lineup checklist first
  if (lastFl === "before_takeoff" && slowGround) {
    return {
      id: "call_lineup_checklist",
      title: "Before takeoff checklist below the line",
      phrases: ["before takeoff checklist below the line"]
    }
  }

  // After taxi checklist → line-up / runway entry
  if (lastCl === "before_takeoff_to_the_line" && ias <= LINEUP_MAX_IAS) {
    return {
      id: "after_taxi",
      title: "Line up",
      phrases: ["runway entry procedure", "clear to line up"]
    }
  }

  // After flight controls check flow → only taxi checklist remains
  if (lastFl === "after_flight_controls_check" && ias <= TAXI_MAX_IAS) {
    return {
      id: "pre_taxi",
      title: "Before takeoff checklist to the line",
      phrases: ["before takeoff checklist to the line"]
    }
  }

  // After clear_left flow → flight controls check + taxi checklist
  if (lastFl === "clear_left" && ias <= TAXI_MAX_IAS) {
    return {
      id: "post_clear_left",
      title: "Taxi",
      phrases: ["flight controls check"]
    }
  }

  // After after_start checklist → full taxi prep sequence
  if (lastCl === "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "taxi_phase",
      title: "Taxi",
      phrases: ["clear left"]
    }
  }

  // After after_start flow done, after_start CL not yet run → call for after start
  if (lastFl === "after_start" && lastCl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_start_running",
      title: "After start",
      phrases: ["after start checklist"]
    }
  }

  // After before_start checklist done → engine start
  if (lastCl === "before_start_below_the_line" && lastFl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "engine_start",
      title: "Engine start",
      phrases: ["start engine X"]
    }
  }

  // After before_start flow done, checklist not yet called → call for before start
  if (lastFl === "before_start" && lastCl !== "before_start" && ias <= TAXI_MAX_IAS) {
    const isCargo = getA300Variant() === "cargo"
    const armSlides = isCargo
      ? "arm slides (ENSURE ALL DOORS ARE CLOSED!)"
      : "cabin crew arm slides (ENSURE ALL DOORS ARE CLOSED!)"
    return {
      id: "call_before_start_checklist",
      title: "Ready for before start",
      phrases: ["before start checklist below the line", armSlides]
    }
  }

  // After cockpit_preparation checklist → ready to call before start / arm slides
  if (lastCl === "before_start_to_the_line") {
    return {
      id: "post_cockpit_prep",
      title: "Before start",
      phrases: ["before start procedure", "start the apu", "apu bleed on"]
    }
  }

  // ── Engines off ─────────────────────────────────────────────────────────────

  // Timeline running → hint cockpit preparation checklist only
  if (preflightTimerRunning && engOff) {
    return {
      id: "prep_timeline",
      title: "Prepare",
      phrases: ["before start checklist to the line", "start the apu", "apu bleed on"]
    }
  }

  // Cold & dark, no timeline → initial sequence
  if (engOff) {
    return {
      id: "prep",
      title: "Prepare",
      phrases: ["lets prepare the aircraft", "lets prepare the flight", "lets set up the aircraft"]
    }
  }

  return null
}
