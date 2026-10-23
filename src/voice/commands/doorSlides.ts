import { setLvar, simvarGet } from "@/API/simvarApi"

export async function setDoorSlides(shouldArm: boolean) {
  const armed = await simvarGet("(L:INI_SLIDE1L_ARMED)").catch((error) => {
    console.error("[SimVar] Failed to read slides state (L:INI_SLIDE1L_ARMED):", error)
    return undefined
  })

  if (armed === undefined) return

  // Already in the requested state, do nothing
  if ((armed ?? 0) > 0.5 === shouldArm) {
    return
  }

  const targetValue = shouldArm ? 1 : 0

  await setLvar(targetValue, "INI_SLIDE1L_ARMED", "slide1")
  await setLvar(targetValue, "INI_SLIDE1R_ARMED", "slide2")
  await setLvar(targetValue, "INI_SLIDE2L_ARMED", "slide3")
  await setLvar(targetValue, "INI_SLIDE2R_ARMED", "slide4")
  await setLvar(targetValue, "INI_SLIDE3L_ARMED", "slide5")
  await setLvar(targetValue, "INI_SLIDE3R_ARMED", "slide6")
  await setLvar(targetValue, "INI_SLIDE4L_ARMED", "slide7")
  await setLvar(targetValue, "INI_SLIDE4R_ARMED", "slide8")
}
