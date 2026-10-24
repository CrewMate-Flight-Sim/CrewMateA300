import arrivalAtAircraft from "@/data/flows/0_arrival_at_aircraft.json"
import afterTakeoffP2 from "@/data/flows/10_both_packs.json"
import climbTenThousand from "@/data/flows/11_climb_ten_thousand_flow.json"
import desPrep from "@/data/flows/12_des_prep.json"
import descTenThousand from "@/data/flows/13_desc_ten_thousand_flow.json"
import landing from "@/data/flows/14_landing.json"
import afterLanding from "@/data/flows/15_after_landing.json"
import parking from "@/data/flows/16_shutdown.json"
import secure from "@/data/flows/17_secure.json"
import prelimCockpitPrep from "@/data/flows/1_prelim_cockpit_prep.json"
import cockpitPrep from "@/data/flows/2_cockpit_prep.json"
import beforeStart from "@/data/flows/3_before_start.json"
import afterStart from "@/data/flows/4_after_start.json"
import clearLeft from "@/data/flows/5_clear_left.json"
import afterControlsCheck from "@/data/flows/6_after_flight_controls_check.json"
import beforeTakeoff from "@/data/flows/7_before_takeoff.json"
import takeoff from "@/data/flows/8_takeoff.json"
import afterTakeoffP1 from "@/data/flows/9_thr_red.json"
import { usePerformanceStore } from "@/store/performanceStore"
import type { Flow, FlowStep } from "@/types/flow"

export const ALL_FLOWS: Flow[] = [
  arrivalAtAircraft,
  prelimCockpitPrep,
  cockpitPrep,
  beforeStart,
  afterStart,
  clearLeft,
  afterControlsCheck,
  beforeTakeoff,
  takeoff,
  afterTakeoffP1,
  afterTakeoffP2,
  climbTenThousand,
  desPrep,
  descTenThousand,
  landing,
  afterLanding,
  parking,
  secure
] as Flow[]

export function getFlowById(id: string): Flow | undefined {
  return ALL_FLOWS.find((f) => f.id === id)
}

async function getTemplateVars(): Promise<Record<string, string>> {
  const { takeoff, landing } = usePerformanceStore.getState()
  const vars: Record<string, string> = {}

  const flapsMap: Record<string, string> = {
    "1": "1",
    "2": "2",
    "3": "3"
  }
  vars["flaps"] = flapsMap[takeoff.flaps] ?? "1"

  const packsOn = takeoff.packs !== "off"
  const apuPacks = takeoff.packs === "apu"
  vars["apu_cmd"] = apuPacks ? "1 (>L:INI_apu_master_switch)" : "0 (>L:INI_apu_master_switch)"
  vars["apu_expect"] = apuPacks ? "1" : "0"
  vars["apu_bleed_cmd"] = apuPacks ? "1 (>L:INI_apu_bleed)" : "0 (>L:INI_apu_bleed)"
  vars["apu_bleed_expect"] = apuPacks ? "1" : "0"
  vars["pack1_cmd"] = packsOn ? "1 (>L:INI_PACK1_BUTTON)" : "0 (>L:INI_PACK1_BUTTON)"
  vars["pack2_cmd"] = packsOn ? "1 (>L:INI_PACK2_BUTTON)" : "0 (>L:INI_PACK2_BUTTON)"
  vars["pack1_expect"] = packsOn ? "1" : "0"
  vars["pack2_expect"] = packsOn ? "1" : "0"

  const antiIce = takeoff.antiIce ?? "off"
  const engAntiIce = antiIce === "oneng" || antiIce === "onengwing"
  const wingAntiIce = antiIce === "onengwing"

  vars["anti_ice_eng1_cmd"] = engAntiIce ? "1 (>L:INI_ENG1_ANTI_ICE)" : "0 (>L:INI_ENG1_ANTI_ICE)"
  vars["anti_ice_eng2_cmd"] = engAntiIce ? "1 (>L:INI_ENG2_ANTI_ICE)" : "0 (>L:INI_ENG2_ANTI_ICE)"
  vars["anti_ice_wing_cmd"] = wingAntiIce ? "1 (>L:INI_WING_ANTI_ICE)" : "0 (>L:INI_WING_ANTI_ICE)"
  vars["anti_ice_eng1_expect"] = engAntiIce ? "1" : "0"
  vars["anti_ice_eng2_expect"] = engAntiIce ? "1" : "0"
  vars["anti_ice_wing_expect"] = wingAntiIce ? "1" : "0"

  vars["pitch_trim_cmd"] = `${takeoff.trimRatio} (>L:ELEV_TRIM_RATIO)`
  vars["pitch_trim_expect"] = String(takeoff.trimRatio)

  const autoBrakeMap: Record<string, string> = {
    off: "0",
    min: "1",
    med: "2",
    max: "3"
  }

  const autoBrakeMapped = autoBrakeMap[landing.autoBrake ?? "med"] ?? "2"
  const roundedElev = Math.round(landing.landingElevation / 50) * 50

  vars["autobrake_set"] = `${autoBrakeMapped} (>L:INI_AUTOBRAKE_LEVEL)`
  vars["autobrake_expect"] = autoBrakeMapped

  vars["landing_elevation_cmd"] = `${roundedElev} (>L:INI_LANDING_ELEVATION)`
  vars["landing_elevation_expect"] = String(roundedElev)

  const APPR_NAV_MODE_VALUES = { vor: 0, nav: 1, ils: 2 } as const

  const apprNavMode = landing.apprNavMode ?? "ils"
  const apprNavModeValue = APPR_NAV_MODE_VALUES[apprNavMode as keyof typeof APPR_NAV_MODE_VALUES] ?? 2
  vars["appr_nav_mode_on"] = `${apprNavModeValue} (>L:INI_EFIS_SELECTED_NAV_FO)`
  vars["appr_nav_mode_expect"] = `${apprNavModeValue} (L:INI_EFIS_SELECTED_NAV_FO) `
  return vars
}

function resolveString(str: string, vars: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

export async function resolveStep(step: FlowStep, vars?: Record<string, string>): Promise<FlowStep> {
  const templateVars = vars ?? (await getTemplateVars())
  const resolvedOnlyIf = step.only_if
    ? {
        ...step.only_if,
        ...("read" in step.only_if
          ? { read: resolveString(step.only_if.read, templateVars) }
          : { option: resolveString(step.only_if.option, templateVars) }),
        one_of: step.only_if.one_of.map((value) =>
          typeof value === "string" ? resolveString(value, templateVars) : value
        )
      }
    : undefined

  return {
    ...step,
    label: resolveString(step.label, templateVars),
    read: resolveString(step.read, templateVars),
    on: resolveString(step.on, templateVars),
    expect: typeof step.expect === "string" ? parseFloat(resolveString(step.expect, templateVars)) || 0 : step.expect,
    only_if: resolvedOnlyIf
  }
}

export async function resolveFlow(flow: Flow): Promise<Flow> {
  const vars = await getTemplateVars()
  return {
    ...flow,
    steps: await Promise.all(flow.steps.map((s) => resolveStep(s, vars)))
  }
}
