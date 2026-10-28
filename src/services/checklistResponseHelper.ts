import { useTelemetryStore } from "@/store/telemetryStore"
import type { ChecklistItem } from "@/types/checklist"

export const WEIGHT_UNITS = new Set(["tons", "kilograms", "pounds", "kilograms balanced", "pounds balanced"])

/** Applies final display formatting: weight units → "xxx.x <unit>", feet → "xxxx feet" */
export function renderResponseToken(token: string): string {
  if (WEIGHT_UNITS.has(token)) return `xxx.x ${token}`
  if (token === "feet") return "xxxx feet"
  return token.replace("#.#", "x.x")
}

export function formatResponseToken(token: string): string {
  if (token === "#2") return "##"
  if (token === "#3") return "###"
  if (token === "#4") return "####"
  // Replace any embedded #N placeholders (e.g. "#4 set") with visual hashes
  return token.replace(/#4/g, "####").replace(/#3/g, "###").replace(/#2/g, "##")
}

const NUMERIC_SET_LABELS = [/altimeter/i, /landing elevation/i, /minimums/i]

function expectsNumericSet(item: ChecklistItem, tokens: string[]): boolean {
  const labelStr = Array.isArray(item.label) ? item.label.join(" ") : (item.label ?? "")

  if (item.baro_confirmation) return true
  if (NUMERIC_SET_LABELS.some((re) => re.test(labelStr))) return true

  return tokens.some((s) => {
    const l = s.toLowerCase()
    if (l.includes("qnh") || l.includes("altimeter")) return true
    if (l.includes("feet set")) return true
    if (/#\s*set\b/.test(l)) return true
    if (/\b\d+\s*set\b/.test(l)) return true
    return false
  })
}

export function getDisplayResponses(item: ChecklistItem): string[] {
  const base = (item.response ?? []).map(formatResponseToken)

  const extras: string[] = []

  // Baro confirmation: show clear examples the pilot can say
  if (item.baro_confirmation) {
    extras.push("qnh #4 set", "altimeter #4 set", "#4 set")
  }

  // Takeoff confirmation: show only the currently-configured thrust variant + safeword
  if (item.takeoff_confirmation) {
    const telemetry = useTelemetryStore.getState().telemetry
    const flexTemp = telemetry?.iniFlexTemperature
    const thrust =
      telemetry?.thrustRatingMode === 6 ? `flex ${flexTemp !== undefined ? Math.round(flexTemp) : "??"}` : "toga"

    return [
      `v1 ${telemetry?.v1 ?? "??"} vr ${telemetry?.vr ?? "??"} v2 ${telemetry?.v2 ?? "??"} ${thrust}`,
      "set and checked"
    ]
  }

  const labelStr = Array.isArray(item.label) ? item.label.join(" ") : (item.label ?? "")

  if (labelStr.includes("Minimums")) {
    extras.push("mda #4 feet set", "dh #4 feet set")
  }

  if (labelStr.includes("Pitch Trim")) {
    extras.push("#.# up set", "#.# down set")
  }

  if (labelStr.includes("Landing Elevation")) {
    extras.push("#4 feet set")
  }

  // Merge, preserve order, remove duplicates
  const combined = [...extras, ...base]
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of combined) {
    const v = formatResponseToken(t)
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }

  // If explicit BARO/RADIO examples were added, hide the generic "feet"
  let filtered = out
  if (filtered.some((s) => s.toLowerCase().includes("baro") || s.toLowerCase().includes("radio"))) {
    filtered = filtered.filter((s) => s.toLowerCase() !== "feet")
  }

  // Hide the plain "set" token if the item expects a numeric/unit-based set
  // (e.g. Altimeters, Landing Elevation). Keep "set and checked".
  if (expectsNumericSet(item, filtered)) {
    filtered = filtered.filter((s) => s.toLowerCase() !== "set")
  }

  // Apply final display formatting (weight units, feet) so all consumers get ready-to-display strings
  return filtered.map(renderResponseToken)
}
