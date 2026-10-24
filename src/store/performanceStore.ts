import { listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface TakeoffData {
  trim: number
  trimRatio: number
  flaps: string
  packs?: string
  antiIce?: string
}

interface LandingData {
  transitionLevel: number
  missedAltitude: number
  antiIce?: string
  apuStart?: string
  autoBrake?: string
  landingElevation: number
  apprNavMode?: string
}

interface PerformanceStore {
  takeoff: TakeoffData
  landing: LandingData
  setTakeoffData: (data: Partial<TakeoffData>) => void
  setLandingData: (data: Partial<LandingData>) => void
  resetTakeoffData: () => void
  resetLandingData: () => void
}

const toTrimRatio = (trim: number) => (trim >= 0 ? trim / 14 : trim / 3)

const DEFAULT_TAKEOFF_DATA: TakeoffData = {
  trim: 0,
  trimRatio: toTrimRatio(0),
  flaps: "1",
  packs: "on",
  antiIce: "off"
}

const DEFAULT_LANDING_DATA: LandingData = {
  transitionLevel: 6000,
  missedAltitude: 4000,
  antiIce: "off",
  apuStart: "auto",
  autoBrake: "med",
  landingElevation: 0,
  apprNavMode: "ils"
}

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set) => ({
      takeoff: DEFAULT_TAKEOFF_DATA,
      landing: DEFAULT_LANDING_DATA,
      setTakeoffData: (data) =>
        set((state) => {
          const next = { ...state.takeoff, ...data }
          if (data.trim !== undefined) next.trimRatio = toTrimRatio(next.trim)
          return { takeoff: next }
        }),
      setLandingData: (data) =>
        set((state) => ({
          landing: { ...state.landing, ...data }
        })),
      resetTakeoffData: () => set({ takeoff: DEFAULT_TAKEOFF_DATA }),
      resetLandingData: () => set({ landing: DEFAULT_LANDING_DATA })
    }),
    {
      name: "performance-data",
      merge: (persisted, current) => {
        const p = persisted as Partial<PerformanceStore> | undefined
        const takeoff = { ...current.takeoff, ...p?.takeoff }
        if (takeoff.trimRatio === undefined) takeoff.trimRatio = toTrimRatio(takeoff.trim ?? 0)
        return { ...current, ...p, takeoff }
      }
    }
  )
)

listen<Partial<TakeoffData>>("takeoff-updated", (event) => {
  usePerformanceStore.getState().setTakeoffData(event.payload)
})

listen<Partial<LandingData>>("landing-updated", (event) => {
  usePerformanceStore.getState().setLandingData(event.payload)
})
