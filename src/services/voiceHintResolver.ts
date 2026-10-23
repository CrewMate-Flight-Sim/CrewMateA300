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
  const radioAlt = num(t, "radioAlt") ?? 0
  const flapsIndex = num(t, "flapsIndex") ?? 0
  const ground = isOnGround(t)
  const engOff = enginesOff(t)
  const landingGear = num(t, "landingGear") ?? 0
  const transitionAltitude = num(t, "transitionAltitude") ?? 5000
  const transitionLevel = usePerformanceStore.getState().landing.transitionLevel || 5000
  const onStandard = num(t, "baroMode") === 1

  // ── AIRBORNE ────────────────────────────────────────────────────────────────
  if (!ground) {
    const descending = vs < -300

    // Initial climb
    if ((lastFl === "takeoff" || lastFl === "both_packs" || lastFl === "thr_red") && !descending && flapsIndex > 0) {
      return {
        id: "initial_climb",
        title: "Initial climb",
        phrases: ["gear up", "flaps X", "slats retract", "autopilot on"]
      }
    }

    if (!descending && alt > transitionAltitude && onStandard && lastCl === "climb_to_the_line") {
      return {
        id: "after_takeoff_below_line",
        title: "After takeoff climb",
        phrases: ["after takeoff climb checklist below the line"]
      }
    }

    if (!descending && flapsIndex === 0 && lastFl === "both_packs") {
      return {
        id: "after_takeoff_to_line",
        title: "After takeoff climb",
        phrases: ["after takeoff climb checklist to the line"]
      }
    }

    // Short final — radioAlt below threshold, descending
    if (lastCl == "approach" && radioAlt > 5 && landingGear == 1 && flapsIndex >= 2) {
      return {
        id: "short_final1",
        title: "Short final",
        phrases: ["landing checklist", "go around flaps", "continue"]
      }
    }

    if (lastCl == "landing" && radioAlt > 5 && landingGear == 1 && flapsIndex >= 2) {
      return {
        id: "short_final2",
        title: "Short final",
        phrases: ["go around flaps", "continue"]
      }
    }

    // 15a. Approach checklist already done — only gear/flaps left
    if (lastCl == "approach" && alt < transitionLevel && alt <= 10000 && !onStandard) {
      return {
        id: "approach",
        title: "Approach",
        phrases: ["gear down", "flaps X", "slats extend"]
      }
    }

    // 15b. Approach checklist not yet done — full prompt
    if (descending && alt < transitionLevel && alt <= 10000 && !onStandard) {
      return {
        id: "approach_checklist",
        title: "Approach",
        phrases: ["approach checklist", "gear down", "flaps X", "slats extend"]
      }
    }

    // Climb / cruise — above 3 000 ft, flaps clean, not descending
    const cruisePhrases: string[] = []
    if (alt > transitionAltitude && !onStandard) cruisePhrases.push("pull standard")
    if (alt > 10000) cruisePhrases.push("seatbelts off")
    if (lastCl === "climb_below_the_line") cruisePhrases.push("set landing elevation")

    return {
      id: "climb_cruise",
      title: "Climb / cruise",
      phrases: cruisePhrases
    }
  }

  // ── GROUND ──────────────────────────────────────────────────────────────────
  //
  // Milestone chain (first match wins — ordered by latest SOP milestone)
  //
  const slowGround = ias <= LINEUP_MAX_IAS

  if (lastFl === "shutdown") {
    return {
      id: "parking",
      title: "Parking",
      phrases: ["parking checklist"]
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
      phrases: ["thrust srs heading", "stop"]
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
      phrases: ["runway entry procedure", "clear to line up", "before takeoff checklist below the line"]
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
      phrases: ["flight controls check", "before takeoff checklist to the line"]
    }
  }

  // After after_start checklist → full taxi prep sequence
  if (lastCl === "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "taxi_phase",
      title: "Taxi",
      phrases: ["clear left", "flight controls check", "before takeoff checklist to the line"]
    }
  }

  // After after_start flow done, after_start CL not yet run → call for after start
  if (lastFl === "after_start" && lastCl !== "after_start" && ias <= TAXI_MAX_IAS) {
    return {
      id: "after_start_running",
      title: "After start",
      phrases: ["after start checklist", "flight controls check"]
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
    return {
      id: "call_before_start_checklist",
      title: "Ready for before start",
      phrases: ["before start checklist below the line"]
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
