import { simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { useTelemetryStore } from "@/store/telemetryStore"

const DETENT_EVENTS = ["FLAPS_UP", "FLAPS_1", "FLAPS_2", "FLAPS_3", "FLAPS_DOWN"]
const DETENT_DELAY_MS = 400

// Serialises overlapping moves: a second call waits for the first to finish
// instead of interleaving detent events and leaving the lever at an
// indeterminate position with overlapping announcements.
let flapsQueue: Promise<void> = Promise.resolve()

function enqueueMove(target: number): Promise<void> {
  return new Promise<void>((resolve) => {
    flapsQueue = flapsQueue
      .catch(() => {})
      .then(async () => {
        try {
          await moveFlapsLeverInternal(target)
        } finally {
          resolve()
        }
      })
  })
}

async function moveFlapsLeverInternal(target: number) {
  // Re-read flapsIndex on every step so the lever keeps stepping correctly
  // if it moved meanwhile (e.g. another command arrived mid-move). Cap the
  // iterations so a stuck telemetry value can never spin forever.
  for (let guard = 0; guard < DETENT_EVENTS.length + 1; guard++) {
    const current = Math.round(useTelemetryStore.getState().telemetry?.flapsIndex ?? 0)
    if (current === target) return

    const direction = target > current ? 1 : -1
    const next = current + direction
    await simvarSet(`(>K:${DETENT_EVENTS[next]})`)
    if (next === target) return
    await delay(DETENT_DELAY_MS)
  }
}

export async function moveFlapsLever(target: number) {
  if (!DETENT_EVENTS[target]) return
  return enqueueMove(target)
}
