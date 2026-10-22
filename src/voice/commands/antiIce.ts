import { setLvar } from "@/API/simvarApi"

export async function setEngAntiIce(position: number) {
  await setLvar(position, "INI_ENG1_ANTI_ICE", "engine 1 anti-ice")
  await setLvar(position, "INI_ENG2_ANTI_ICE", "engine 2 anti-ice")
}

export async function setWingAntiIce(position: number) {
  await setLvar(position, "INI_WING_ANTI_ICE", "wing anti-ice")
}
