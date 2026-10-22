import { setLvar } from "@/API/simvarApi"

export async function setBrakeFan(on: boolean) {
  await setLvar(on ? 1 : 0, "A310_brake_fan_on", "brake fan")
}
