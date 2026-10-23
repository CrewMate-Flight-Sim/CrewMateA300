import { emit } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Info } from "lucide-react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { usePerformanceStore } from "@/store/performanceStore"

const SELECT_CLS =
  "w-full h-8 bg-slate-900/50 border border-slate-600 text-white text-xs rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"

const MISSED_ALT_MIN = 1000
const MISSED_ALT_MAX = 20000
const MISSED_ALT_STEP = 100

const formatToFL = (value: number | undefined | null) => {
  if (!value) return ""
  // Converts 18000 -> "FL180"
  return `FL${Math.floor(value / 100)
    .toString()
    .padStart(3, "0")}`
}

export function LandingWindow() {
  const { landing, setLandingData } = usePerformanceStore()
  const missedRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCurrentWindow()
      .show()
      .catch(() => {})
  }, [])

  // React's onWheel is passive and can't stop the browser's own number input scrolling
  useEffect(() => {
    const input = missedRef.current
    if (!input) return
    const handler = (e: WheelEvent) => e.preventDefault()
    input.addEventListener("wheel", handler, { passive: false })
    return () => input.removeEventListener("wheel", handler)
  }, [])

  const handleChange = (name: string, value: string | number) => {
    setLandingData({ [name]: value } as Partial<typeof landing>)
    emit("landing-updated", { ...landing, [name]: value })
  }

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.name, Number(e.target.value))
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange(e.target.name, e.target.value)
  }

  // Rounds too, so a typed 3550 steps to 3500 or 3600
  const handleMissedWheel = (deltaY: number) => {
    const step = deltaY > 0 ? -MISSED_ALT_STEP : MISSED_ALT_STEP
    const next = Math.round((landing.missedAltitude + step) / MISSED_ALT_STEP) * MISSED_ALT_STEP
    handleChange("missedAltitude", Math.max(MISSED_ALT_MIN, Math.min(MISSED_ALT_MAX, next)))
  }

  const labelRow = "flex items-center gap-1 h-4"

  return (
    <div className="h-screen bg-black text-white p-3 flex flex-col gap-3">
      {/* Row 1: Anti Ice + Transition Level + Landing Elevation */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="antiIce" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Anti Ice
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-cyan-400 transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px] bg-slate-800 border-slate-700">
                  Will leave Flaps down on "After Landing" flow if Anti Ice is used
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <select
            id="antiIce"
            name="antiIce"
            value={landing.antiIce}
            onChange={handleSelectChange}
            className={SELECT_CLS}
          >
            <option value="off">OFF</option>
            <option value="oneng">ENG</option>
            <option value="onengwing">ENG+WING</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Label
                htmlFor="transitionLevel"
                className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest"
              >
                TL
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-cyan-400 transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-[200px] bg-slate-800 border-slate-700">
                    Transition Level
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono">{formatToFL(landing.transitionLevel)}</span>
          </div>

          <Input
            type="text"
            inputMode="numeric"
            id="transitionLevel"
            name="transitionLevel"
            value={landing.transitionLevel ?? ""}
            onChange={(e) => {
              const val = e.target.value
              if (val === "" || /^\d+$/.test(val)) {
                handleChange("transitionLevel", val === "" ? "" : Number(val))
              }
            }}
            onWheel={(e) => {
              e.preventDefault()
              const delta = e.deltaY < 0 ? 500 : -500
              const current = Number(landing.transitionLevel) || 0
              const snapped = Math.min(22000, Math.max(3000, Math.round((current + delta) / 500) * 500))
              handleChange("transitionLevel", snapped)
            }}
            className="h-8 bg-slate-900/50 border-slate-600 text-white text-xs font-mono text-center px-1 focus-visible:ring-cyan-500"
            placeholder="0"
          />
        </div>

        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="landingElevation" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Elev
            </Label>
          </div>
          <Input
            type="number"
            id="landingElevation"
            name="landingElevation"
            value={landing.landingElevation ?? ""}
            onChange={handleNumberInput}
            className="h-8 bg-slate-900/50 border-slate-600 text-white text-xs font-mono text-center px-1 focus-visible:ring-cyan-500"
            placeholder="—"
          />
        </div>
      </div>

      {/* Row 2: Missed App + APU + Auto Brake */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="missedAltitude" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Missed App (ft)
            </Label>
            <Input
              ref={missedRef}
              type="number"
              min={MISSED_ALT_MIN}
              max={MISSED_ALT_MAX}
              id="missedAltitude"
              name="missedAltitude"
              value={landing.missedAltitude}
              onChange={handleNumberInput}
              onWheel={(e) => handleMissedWheel(e.deltaY)}
              className="h-8 bg-slate-900/50 border-slate-600 text-white text-xs font-mono text-center px-1 focus-visible:ring-cyan-500"
              placeholder="4000"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="apuStart" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              APU
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-cyan-400 transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px] bg-slate-800 border-slate-700">
                  Will start the APU on "After Landing" flow if set to "Auto"
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <select
            id="apuStart"
            name="apuStart"
            value={landing.apuStart}
            onChange={handleSelectChange}
            className={SELECT_CLS}
          >
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className={labelRow}>
            <Label htmlFor="autoBrake" className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              AUTO BRAKE
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-cyan-400 transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px] bg-slate-800 border-slate-700">
                  Autobrake will be set after ground spoilers are armed
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <select
            id="autoBrake"
            name="autoBrake"
            value={landing.autoBrake}
            onChange={handleSelectChange}
            className={SELECT_CLS}
          >
            <option value="off">OFF</option>
            <option value="min">LOW</option>
            <option value="med">MED</option>
            <option value="max">MAX</option>
          </select>
        </div>
      </div>

      <Button
        onClick={() => getCurrentWindow().close()}
        className="w-full h-8 bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-sm mt-auto"
      >
        Ok
      </Button>
    </div>
  )
}
