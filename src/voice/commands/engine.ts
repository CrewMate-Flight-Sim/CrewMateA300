import { setLvar, simvarGet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { playSound } from "@/services/playSounds"

export async function setIgnKnob(position: number) {
  await setLvar(position, "INI_ENG_IGNITION_SWITCH", "ignition knob")
}

async function monitorEngineStart(engineNum: number) {
  const isOpenVar = `(L:INI_STARTER${engineNum}_OPEN)`

  // PHASE 1: Wait for Valve to Open
  for (let i = 0; i < 600; i++) {
    const isOpen = await simvarGet(isOpenVar)

    if (isOpen !== null && isOpen > 0.5) {
      await delay(800)
      playSound("valve_open.ogg")
      break // Move to Phase 2
    }
    await delay(100)
  }

  // PHASE 2: Wait for Valve to Close (LVAR returns to 0)
  // We add a small delay so it doesn't immediately "detect" the 0 from Phase 1
  await delay(1000)

  for (let i = 0; i < 600; i++) {
    const isClosed = await simvarGet(isOpenVar)

    // Check for 0 (or less than 0.1 to be safe from float noise)
    if (isClosed !== null && isClosed < 0.1) {
      await delay(800)
      playSound("valve_closed.ogg")
      break // Exit loop, we're done
    }
    await delay(100)
  }
}

export async function startEngine2(position: number) {
  const ok = await setLvar(position, "INI_ENG2_STARTER", "engine 2 starter")
  // Start the "Watcher" in the background
  if (ok && position === 1) {
    monitorEngineStart(2)
  }
}

export async function startEngine1(position: number) {
  const ok = await setLvar(position, "INI_ENG1_STARTER", "engine 1 starter")
  // Start the "Watcher" in the background
  if (ok && position === 1) {
    monitorEngineStart(1)
  }
}
