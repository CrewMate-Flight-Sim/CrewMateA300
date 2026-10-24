import { setLvar, simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { executeFlow } from "@/services/flowRunner"
import { playSound, waitForSoundFinished } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

const AXIS_FULL_POS = 16383
const AXIS_FULL_NEG = -16383
const AXIS_NEUTRAL = 0

const RUDDER_FULL_THRESHOLD = 0.45
const RUDDER_NEUTRAL_THRESHOLD = 0.15

interface CAStep {
  condition: (t: Telemetry) => boolean
  sound?: string
}

interface FOStep {
  setValue: () => Promise<void>
  sound?: string
}

let isCheckRunning = false

const FO_STEPS: FOStep[] = [
  { setValue: () => simvarSet(`${AXIS_FULL_NEG} (>K:ELEVATOR_SET)`), sound: "full_up.ogg" },
  { setValue: () => simvarSet(`${AXIS_NEUTRAL} (>K:ELEVATOR_SET)`) },
  { setValue: () => simvarSet(`${AXIS_FULL_POS} (>K:ELEVATOR_SET)`), sound: "full_down.ogg" },
  { setValue: () => simvarSet(`${AXIS_NEUTRAL} (>K:ELEVATOR_SET)`), sound: "neutral.ogg" },
  { setValue: () => simvarSet(`${AXIS_FULL_POS} (>K:AILERON_SET)`), sound: "full_left.ogg" },
  { setValue: () => simvarSet(`(>K:CENTER_AILER_RUDDER)`) },
  { setValue: () => simvarSet(`${AXIS_FULL_NEG} (>K:AILERON_SET)`), sound: "full_right.ogg" },
  { setValue: () => simvarSet(`(>K:CENTER_AILER_RUDDER)`), sound: "neutral.ogg" }
]

const RUDDER_STEPS: CAStep[] = [
  { condition: (t) => t.rudderPosition < -RUDDER_FULL_THRESHOLD, sound: "full_left.ogg" },
  { condition: (t) => t.rudderPosition > RUDDER_FULL_THRESHOLD, sound: "full_right.ogg" },
  { condition: (t) => Math.abs(t.rudderPosition) < RUDDER_NEUTRAL_THRESHOLD, sound: "neutral.ogg" }
]

function waitFor(condition: (t: Telemetry) => boolean): Promise<void> {
  const current = useTelemetryStore.getState().telemetry
  if (current && condition(current)) return Promise.resolve()

  return new Promise((resolve) => {
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
  const tInit = useTelemetryStore.getState().telemetry
  if (tInit?.onGround !== 1) {
    return
  }

  if (isCheckRunning) return
  isCheckRunning = true

  try {
    await waitForSoundFinished()

    // FO sets elevator and aileron positions and calls out each state
    for (const step of FO_STEPS) {
      // 1. SAFETY: Ensure any audio from the PRIOR step is 100% silent before moving hardware
      await waitForSoundFinished()

      // 2. Send command to physically move the control surface
      await step.setValue()

      // 3. Physical transit wait (increased to 2200ms for full high-fidelity hydraulic sweep)
      await delay(750)

      if (step.sound) {
        // 4. Play sound only once the mechanical step is verified complete
        await playSound(step.sound)

        // 5. Block right here until THIS step's speech is completely finished
        await waitForSoundFinished()

        // 6. Natural human breathing room pause before loop cycles back to step 1
        await delay(400)
      } else {
        // Padding for internal silent centering resets
        await delay(300)
      }
    }

    // Captain performs rudder check — script blocks until physical input matches threshold
    for (const step of RUDDER_STEPS) {
      await waitFor(step.condition)
    }
  } catch (error) {
    console.error("[FlightControlsCheck] Execution failure:", error)
  } finally {
    await centerControls()
    isCheckRunning = false
  }

  executeFlow("after_flight_controls_check")
}
