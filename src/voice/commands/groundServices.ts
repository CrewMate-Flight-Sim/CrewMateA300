import { gsxClient } from "@/API/gsxApi"
import { setLvar } from "@/API/simvarApi"

gsxClient.connect()

export async function setGPU(on: boolean) {
  await setLvar(on ? 1 : 0, "INI_GPU_AVAIL", "GPU")
}

export async function disconnectAllGround() {
  await setGPU(false)
}

export async function callPushback() {
  try {
    await gsxClient.triggerService("Departure")
  } catch (error) {
    console.error("[GroundServices] Failed to call GSX pushback:", error)
  }
}
