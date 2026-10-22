import { listen } from "@tauri-apps/api/event"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface TakeoffData {
  trim: number
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
}

interface PerformanceStore {
  takeoff: TakeoffData
  landing: LandingData
  setTakeoffData: (data: Partial<TakeoffData>) => void
  setLandingData: (data: Partial<LandingData>) => void
  resetTakeoffData: () => void
  resetLandingData: () => void
}

const DEFAULT_TAKEOFF_DATA: TakeoffData = {
  trim: 0,
  flaps: "1",
  packs: "on",
  antiIce: "off"
}

const DEFAULT_LANDING_DATA: LandingData = {
  transitionLevel: 0,
  missedAltitude: 4000,
  antiIce: "off",
  apuStart: "auto",
  autoBrake: "med",
  landingElevation: 0
}

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set) => ({
      takeoff: DEFAULT_TAKEOFF_DATA,
      landing: DEFAULT_LANDING_DATA,
      setTakeoffData: (data) =>
        set((state) => ({
          takeoff: { ...state.takeoff, ...data }
        })),
      setLandingData: (data) =>
        set((state) => ({
          landing: { ...state.landing, ...data }
        })),
      resetTakeoffData: () => set({ takeoff: DEFAULT_TAKEOFF_DATA }),
      resetLandingData: () => set({ landing: DEFAULT_LANDING_DATA })
    }),
    {
      name: "performance-data"
    }
  )
)

listen<Partial<TakeoffData>>("takeoff-updated", (event) => {
  usePerformanceStore.getState().setTakeoffData(event.payload)
})

listen<Partial<LandingData>>("landing-updated", (event) => {
  usePerformanceStore.getState().setLandingData(event.payload)
})
