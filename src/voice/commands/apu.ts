import { setLvar } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { useTelemetryStore } from "@/store/telemetryStore"
import { useVoiceHintProgressStore } from "@/store/voiceHintProgressStore"

function waitForApuN1(threshold: number, timeoutMs = 120000): Promise<void> {
  const current = useTelemetryStore.getState().telemetry
  if (current && (current.apuN1 ?? 0) >= threshold) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const start = Date.now()
    const unsub = useTelemetryStore.subscribe((state) => {
      const t = state.telemetry
      if (!t) return

      const n1 = t.apuN1 ?? 0
      if (n1 >= threshold) {
        unsub()
        resolve()
        return
      }

      if (Date.now() - start > timeoutMs) {
        unsub()
        reject(new Error(`APU N1 did not reach ${threshold}% within timeout`))
      }
    })
  })
}

export async function setAPUBleed(position: number) {
  await setLvar(position, "INI_APU_BLEED", "APU bleed")
}

export async function setStartAPU(position: number) {
  const ok = await setLvar(position, "INI_APU_MASTER_SWITCH", "APU master switch")
  if (!ok) return

  await delay(2000)

  await setLvar(position, "INI_APU_START_BUTTON", "APU start button")

  try {
    const lastFlow = useVoiceHintProgressStore.getState().lastCompletedFlowId
    if (lastFlow === "after_landing") {
      return
    }

    await waitForApuN1(90, 180000)
    await delay(120000)
    await setAPUBleed(1)
  } catch (error) {
    console.error("[APU] Failed waiting for APU N1 to reach 90%:", error)
  }
}
