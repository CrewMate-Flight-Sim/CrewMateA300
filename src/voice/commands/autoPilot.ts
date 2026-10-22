import { setLvar } from "@/API/simvarApi"
import { playSound } from "@/services/playSounds"

// Autopilot commands
export async function setAutoPilot(position: number) {
  await setLvar(position, "INI_AP1_BUTTON", "autopilot")
}

export async function setLevelOff(position: number) {
  await setLvar(position, "AP1_BUTTON", "level off")
}

export async function setLOC(position: number) {
  await setLvar(position, "AP6_BUTTON", "localizer")
}

export async function setAPPR(position: number) {
  await setLvar(position, "AP7_BUTTON", "approach")
}

export async function setLVLCH(position: number) {
  await setLvar(position, "AP2_BUTTON", "levelchange")
}
// Flight director commands
export async function setFlightDirector(position: number) {
  await setLvar(position, "INI_FDIR_SWITCH_CAPT", "captain flight director")
  await setLvar(position, "INI_FDIR_SWITCH_FO", "FO flight director")
}

// Speed commands
export async function setAirspeedDial(knots: number) {
  if (knots < 50 || knots > 400) return
  if (await setLvar(knots, "INI_Airspeed_Dial", "airspeed dial")) {
    playSound("check.ogg")
  }
}

export async function setSelSpeed(position: number) {
  await setLvar(position, "INI_FCU_SELECTED_SPEED_BUTTON", "selected speed")
}

// Heading commands
export async function setHeadingDial(degrees: number) {
  if (degrees < 0 || degrees > 360) return
  if (await setLvar(degrees, "INI_HEADING_DIAL", "heading dial")) {
    playSound("check.ogg")
  }
}

export async function syncHeading(position: number) {
  await setLvar(position, "INI_FCU_SYNC_HEADING_BUTTON", "heading sync")
}

export async function setHdgSel(position: number) {
  await setLvar(position, "INI_FCU_SELECTED_HEADING_BUTTON", "selected heading")
}

export async function setNav(position: number) {
  await setLvar(position, "INI_FCU_MANAGED_HEADING_BUTTON", "managed heading")
}

// Altitude commands
export async function setAltitudeDial(feet: number) {
  if (feet < 100 || feet > 49000) return
  await setLvar(feet, "INI_Altitude_Dial", "altitude dial")
}

export async function setSelAlt(position: number) {
  await setLvar(position, "INI_FCU_ALTITUDE_PULL_COMMAND", "selected altitude")
}
