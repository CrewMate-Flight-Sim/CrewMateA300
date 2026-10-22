import { create } from "zustand"

interface RtoStore {
  count: number
  trigger: () => void
}

export const useRtoStore = create<RtoStore>()((set) => ({
  count: 0,
  trigger: () => set((s) => ({ count: s.count + 1 }))
}))
