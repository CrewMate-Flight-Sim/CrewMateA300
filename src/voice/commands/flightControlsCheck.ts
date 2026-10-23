import { setLvar, simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { executeFlow } from "@/services/flowRunner"
import { playSound, waitForSoundFinished } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

const FULL_THRESHOLD = 0.45
const NEUTRAL_THRESHOLD = 0.15

interface Step {
  condition: (t: Telemetry) => boolean
  sound: string
}

const STEPS: Step[] = [
  { condition: (t) => t.elevatorPosition > FULL_THRESHOLD, sound: "full_up.ogg" },
  { condition: (t) => t.elevatorPosition < -FULL_THRESHOLD, sound: "full_down.ogg" },
  { condition: (t) => Math.abs(t.elevatorPosition) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" },

  { condition: (t) => t.aileronPosition < -FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.aileronPosition > FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.aileronPosition) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" },

  { condition: (t) => t.rudderPosition < -FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.rudderPosition > FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.rudderPosition) < NEUTRAL_THRESHOLD, sound: "neutral.ogg" }
]

function waitFor(condition: (t: Telemetry) => boolean): Promise<void> {
  return new Promise((resolve) => {
    // Check immediately in case the condition is already true
    const current = useTelemetryStore.getState().telemetry
    if (current && condition(current)) {
      resolve()
      return
    }

    // Subscribe — fires on every telemetry push from the backend
    const unsub = useTelemetryStore.subscribe((state) => {
      const t = state.telemetry
      if (t && condition(t)) {
        unsub()
        resolve()
      }
    })
  })
}

export async function opencloseFCTLECAM(position: number) {
  await setLvar(position, "PUSH_ECAM_FCTL", "FCTL ECAM page")
}

// Bumped on every call, so a check still waiting goes quiet once a newer one starts
let latestCheck = 0

// Assuming delay is a function like: const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const STEP_DELAY = 800 // milliseconds between movements/checks

const centerControls = async () => {
  try {
    await simvarSet("0 (>K:ELEVATOR_SET)")
  } catch (error) {
    console.error("[flightControlsCheck] Failed to center elevator:", error)
  }
  try {
    await simvarSet("0 (>K:AILERON_SET)")
  } catch (error) {
    console.error("[flightControlsCheck] Failed to center aileron:", error)
  }
}

export async function flightControlsCheck() {
  const check = ++latestCheck
  const tInit = useTelemetryStore.getState().telemetry
  if (!tInit?.onGround) {
    return
  }
  await waitForSoundFinished()

  try {
    // FO moves controls
    await simvarSet("-16384 (>K:ELEVATOR_SET)")
    await delay(STEP_DELAY) // Give it a beat to start moving
    await waitFor((t) => t.elevatorPosition > FULL_THRESHOLD)
    if (check !== latestCheck) return
    await playSound("full_up.ogg")
    await waitForSoundFinished()

    await simvarSet("0 (>K:ELEVATOR_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => Math.abs(t.elevatorPosition) < NEUTRAL_THRESHOLD)
    if (check !== latestCheck) return

    await simvarSet("16384 (>K:ELEVATOR_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => t.elevatorPosition < -FULL_THRESHOLD)
    if (check !== latestCheck) return
    await playSound("full_down.ogg")
    await waitForSoundFinished()

    await simvarSet("0 (>K:ELEVATOR_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => Math.abs(t.elevatorPosition) < NEUTRAL_THRESHOLD)
    if (check !== latestCheck) return
    await playSound("neutral.ogg")
    await waitForSoundFinished()

    await simvarSet("16383 (>K:AILERON_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => t.aileronPosition < -FULL_THRESHOLD)
    if (check !== latestCheck) return
    await playSound("full_left.ogg")
    await waitForSoundFinished()

    await simvarSet("0 (>K:AILERON_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => Math.abs(t.aileronPosition) < NEUTRAL_THRESHOLD)
    if (check !== latestCheck) return

    await simvarSet("-16384 (>K:AILERON_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => t.aileronPosition > FULL_THRESHOLD)
    if (check !== latestCheck) return
    await playSound("full_right.ogg")
    await waitForSoundFinished()

    await simvarSet("0 (>K:AILERON_SET)")
    await delay(STEP_DELAY)
    await waitFor((t) => Math.abs(t.aileronPosition) < NEUTRAL_THRESHOLD)
    if (check !== latestCheck) return
    await playSound("neutral.ogg")
    await waitForSoundFinished()
  } finally {
    await centerControls()
  }

  // PF checks rudder (if PF is moving it via steps or telemetry)
  for (const step of STEPS.slice(6)) {
    await delay(STEP_DELAY)
    await waitFor(step.condition)
    if (check !== latestCheck) return
    await playSound(step.sound)
    await waitForSoundFinished()
  }

  executeFlow("after_flight_controls_check")
}
