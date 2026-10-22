import { delay } from "@/lib/utils"
import { moveFlapsLever } from "@/services/flapsLever"
import { playSound } from "@/services/playSounds"
import { useTelemetryStore } from "@/store/telemetryStore"

const FLAP_SPEED_LIMITS: Record<number, number> = {
  1: 245,
  2: 210,
  3: 195,
  4: 180
}

const SOUND_MAP: Record<number, string> = {
  0: "slats_retr.ogg",
  1: "flaps_0.ogg",
  2: "flaps_15.ogg",
  3: "flaps_20.ogg",
  4: "flaps_40.ogg"
}

export async function setFlaps(setting: number, skipAnnouncement = false) {
  try {
    const { telemetry } = useTelemetryStore.getState()
    const currentSpeed = telemetry?.ias ?? 0
    const isOnGround = telemetry?.onGround ?? 0
    const currentFlapIndex = telemetry?.flapsIndex ?? 0
    const speedLimit = FLAP_SPEED_LIMITS[setting]
    const isInitialExtension = currentFlapIndex === 0 && setting === 1
    const isExtendingOrStatic = setting >= currentFlapIndex && setting > 0
    const isTransition3to4 = currentFlapIndex === 3 && setting === 4

    // 1. FO checks if you're too fast
    if (speedLimit && currentSpeed > speedLimit) {
      playSound("check_speed.ogg")
      return
    }

    // 2. FO says "Speed Checked" (Extension only, skip 3->4)
    if (!isOnGround && isExtendingOrStatic && !isTransition3to4) {
      if (!skipAnnouncement) {
        playSound("speed_checked.ogg")
        await delay(1000)
      }
    }

    // 3. FO moves the lever through each detent (iniBuilds requires this)
    await moveFlapsLever(setting)

    // 4. FO confirms the selection (e.g., "Slats Extend" or "Flaps 15")
    await delay(5000)
    if (isInitialExtension) {
      playSound("slats_ext.ogg")
    } else {
      const confirmation = SOUND_MAP[setting]
      if (confirmation) playSound(confirmation)
    }
  } catch (error) {
    console.error("[Flaps] Error setting flaps:", error)
  }
}
