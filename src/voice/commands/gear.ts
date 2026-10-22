import { simvarGet, simvarSet } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

const GEAR_LOWER_SPEED_LIMIT = 270 // knots
const GEAR_UP_POLL_MS = 200
const GEAR_UP_TIMEOUT_MS = 20000

let gearUpInProgress = false

export async function setGearHandle(position: number) {
  try {
    const { telemetry } = useTelemetryStore.getState()
    const currentSpeed = telemetry?.ias ?? 0

    if (position === 1 && currentSpeed > GEAR_LOWER_SPEED_LIMIT) {
      playSound("check_speed.ogg")
      return
    }

    const eventName = position === 1 ? "GEAR_DOWN" : "GEAR_UP"
    const commandExpression = `(>K:${eventName})`

    if (position === 1) {
      await simvarSet(commandExpression)
      playSound("gear_down.ogg")
    } else {
      await simvarSet(commandExpression)
      if (!gearUpInProgress) void gearUpWhenRetracted()
    }
  } catch (error) {
    console.error("[Gear] Error sending gear key event:", error)
  }
}

async function gearUpWhenRetracted() {
  if (gearUpInProgress) return
  gearUpInProgress = true
  try {
    const deadline = Date.now() + GEAR_UP_TIMEOUT_MS
    while (Date.now() < deadline) {
      const positions = await Promise.all([
        simvarGet("(L:A310_GEAR1_POSITION)"),
        simvarGet("(L:A310_GEAR2_POSITION)"),
        simvarGet("(L:A310_GEAR3_POSITION)")
      ])
      if (positions.every((p) => p === 0)) {
        await simvarSet("1 (>L:A310_GEAR_HANDLE_STATUS)")
        playSound("gear_up.ogg")
        return
      }
      await new Promise((resolve) => setTimeout(resolve, GEAR_UP_POLL_MS))
    }
    console.warn("[Gear] Gear did not retract within timeout; staying silent")
  } catch (error) {
    console.error("[Gear] Error monitoring gear retraction:", error)
  } finally {
    gearUpInProgress = false
  }
}
