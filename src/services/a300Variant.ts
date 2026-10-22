import { useTelemetryStore } from "@/store/telemetryStore"

export type A300Variant = "cargo" | "passenger"

/** Plain function — safe to call in services, runners, etc. */
export function getA300Variant(): A300Variant {
  const title = useTelemetryStore.getState().aircraftTitle
  return /A300[-\s]*600\s*F/i.test(title ?? "") ||
    /A300F/i.test(title ?? "") ||
    /freighter/i.test(title ?? "")
    ? "cargo"
    : "passenger"
}
