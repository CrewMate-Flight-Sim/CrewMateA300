import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useEffect, useRef } from "react"

import { getAircraftTitle } from "@/API/simvarApi"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"

/**
 * Single source of truth: maps each telemetry key to its SimConnect expression.
 * These are sent to the backend once on startup — the backend then pushes values back
 * via the "telemetry_data" event at the requested interval.
 */
const SIM_VARS: { key: string; expression: string }[] = [
  { key: "timeOfDay", expression: "(E:TIME OF DAY,Enum)" },
  { key: "ias", expression: "(A:AIRSPEED INDICATED,Knots)" },
  { key: "alt", expression: "(A:INDICATED ALTITUDE,Feet)" },
  { key: "radioAlt", expression: "(A:PLANE ALT ABOVE GROUND,Feet)" },
  { key: "pAlt", expression: "(A:PRESSURE ALTITUDE,Feet)" },
  { key: "vs", expression: "(A:VERTICAL SPEED,Feet per minute)" },
  { key: "onGround", expression: "(A:SIM ON GROUND,Bool)" },
  { key: "isSlewActive", expression: "(A:IS SLEW ACTIVE,Bool)" },
  { key: "engine1N1", expression: "(A:TURB ENG N1:1,Percent)" },
  { key: "engine2N1", expression: "(A:TURB ENG N1:2,Percent)" },
  { key: "throttleLever1", expression: "(A:GENERAL ENG THROTTLE LEVER POSITION:1,Number)" },
  { key: "throttleLever2", expression: "(A:GENERAL ENG THROTTLE LEVER POSITION:2,Number)" },
  { key: "landingGear", expression: "(A:GEAR HANDLE POSITION,Position)" },
  { key: "brakeLeftPosition", expression: "(A:BRAKE LEFT POSITION,Number)" },
  { key: "parkingBrake", expression: "(A:BRAKE PARKING INDICATOR,Bool)" },
  { key: "brakeRightPosition", expression: "(A:BRAKE RIGHT POSITION,Number)" },
  { key: "aileronPosition", expression: "(A:AILERON POSITION,Position)" },
  { key: "elevatorPosition", expression: "(A:ELEVATOR POSITION,Position)" },
  { key: "rudderPosition", expression: "(A:RUDDER POSITION,Position)" },
  { key: "spoilersHandlePosition", expression: "(A:SPOILERS HANDLE POSITION,Position)" },
  { key: "pitchDegrees", expression: "(A:PLANE PITCH DEGREES,Degrees)" },
  { key: "bankDegrees", expression: "(A:PLANE BANK DEGREES,Degrees)" },
  { key: "speedTarget", expression: "(A:AUTOPILOT AIRSPEED TARGET,Knots)" },
  { key: "locDeviation", expression: "(L:INI_LOC_DEV)" },
  { key: "glideDeviation", expression: "(L:INI_GS_DEV)" },
  { key: "locValid", expression: "(L:INI_LOC_VALID)" },
  { key: "glideValid", expression: "(A:NAV GS FLAG:1, Bool)" },
  { key: "iniFlexTemperature", expression: "(L:INI_FLEX_TEMPERATURE)" },
  { key: "iniThrustFlexN1", expression: "(L:INI_THRUST_FLEX_N1)" },
  { key: "iniThrustTogaN1", expression: "(L:INI_THRUST_TOGA_N1)" },
  { key: "iniFdOnCM1", expression: "(L:INI_FDIR_SWITCH_CAPT)" },
  { key: "iniFdOnCM2", expression: "(L:INI_FDIR_SWITCH_FO)" },
  { key: "efisQnhUnitSelectorLeft", expression: "(A:EFIS_QNH_UNIT_SELECTOR_LEFT, Bool)" },
  { key: "captAltimeterSettingMB", expression: "(A:KOHLSMAN SETTING MB:1, Millibars)" },
  { key: "captAltimeterSettingHG", expression: "(A:KOHLSMAN SETTING HG:1, inHg)" },
  { key: "foAltimeterSettingMB", expression: "(A:KOHLSMAN SETTING MB:2, Millibars)" },
  { key: "foAltimeterSettingHG", expression: "(A:KOHLSMAN SETTING HG:2, inHg)" },
  { key: "iniAltimeterMbCopilot1", expression: "(L:INI_ALTIMETER_MB_COPILOT1)" },
  { key: "iniAltimeterMbCopilot2", expression: "(L:INI_ALTIMETER_MB_COPILOT2)" },
  { key: "iniAltimeterMbCopilot3", expression: "(L:INI_ALTIMETER_MB_COPILOT3)" },
  { key: "iniAltimeterMbCopilot4", expression: "(L:INI_ALTIMETER_MB_COPILOT4)" },
  { key: "iniAltimeterInhgCopilot1", expression: "(L:INI_ALTIMETER_INHG_COPILOT1)" },
  { key: "iniAltimeterInhgCopilot2", expression: "(L:INI_ALTIMETER_INHG_COPILOT2)" },
  { key: "iniAltimeterInhgCopilot3", expression: "(L:INI_ALTIMETER_INHG_COPILOT3)" },
  { key: "iniAltimeterInhgCopilot4", expression: "(L:INI_ALTIMETER_INHG_COPILOT4)" },
  { key: "totalFuelQuantityWeight", expression: "(A:FUEL TOTAL QUANTITY WEIGHT, Pounds)" },
  { key: "iniEngAntiIce1State", expression: "(L:INI_ENG1_ANTI_ICE)" },
  { key: "iniEngAntiIce2State", expression: "(L:INI_ENG2_ANTI_ICE)" },
  { key: "iniWingAntiIce1State", expression: "(L:INI_WING_ANTI_ICE)" },
  { key: "iniAirPack1Button", expression: "(L:INI_PACK1_BUTTON, Bool)" },
  { key: "iniAirPack2Button", expression: "(L:INI_PACK2_BUTTON, Bool)" },
  { key: "ignitionKnob", expression: "(L:INI_eng_ignition_switch)" },
  { key: "flapsIndex", expression: "(A:FLAPS HANDLE INDEX,Number)" },
  { key: "mixture1", expression: "(L:INI_MIXTURE_RATIO1_HANDLE)" },
  { key: "mixture2", expression: "(L:INI_MIXTURE_RATIO2_HANDLE)" },
  { key: "spoilersArmed", expression: "(L:INI_SPOILERS_ARMED)" },
  { key: "fcuAlt", expression: "(L:INI_Altitude_Dial)" },
  { key: "linkedInstruments", expression: "(L:INI_LINKED_INSTRUMENTS)" },
  { key: "arrRunwayHdg", expression: "(L:INI_ARR_RUNWAY_HDG)" },
  { key: "foShowAirports", expression: "(L:INI_SHOW_AIRPORTS2)" },
  { key: "foShowConstraints", expression: "(L:INI_SHOW_CONSTRAINTS2)" },
  { key: "foVor1Active", expression: "(L:INI_FO_VOR1_ACTIVE)" },
  { key: "foVor2Active", expression: "(L:INI_FO_VOR2_ACTIVE)" },
  { key: "foTerrOn", expression: "(L:INI_TERR_ON_FO)" },
  { key: "foWxr2On", expression: "(L:INI_WXR2_ON)" },
  { key: "v1", expression: "(L:INI_V1_FMGS)" },
  { key: "vr", expression: "(L:INI_VR_FMGS)" },
  { key: "v2", expression: "(L:INI_V2_FMGS)" },
  { key: "autobrakeLevel", expression: "(L:INI_AUTOBRAKE_LEVEL)" },
  { key: "thrustReductionAlt", expression: "(L:INI_REDUCTION_ALTITUDE)" },
  { key: "mda", expression: "(L:INI_FMS_MDA)" },
  { key: "dh", expression: "(L:INI_MINIMUMS_PILOT)" },
  { key: "engine1Reverse", expression: "(L:INI_REVERSE1_HANDLE_PERCENT)" },
  { key: "engine2Reverse", expression: "(L:INI_REVERSE2_HANDLE_PERCENT)" },
  { key: "thrustRatingMode", expression: "(L:INI_TRP_MODE)" },
  { key: "foChrono", expression: "(L:INI_CHRONO_TIME_FO)" },
  { key: "taxiLight", expression: "(L:INI_TAXI_LIGHTS_SWITCH)" },
  { key: "baroMode", expression: "(L:XMLVAR_Baro1_Mode)" },
  { key: "gdSpeed", expression: "(L:FMGEC_GD_SPEED)" },
  { key: "sSpeed", expression: "(L:FCPC_S_SPEED)" },
  { key: "fSpeed", expression: "(L:FCPC_F_SPEED)" },
  { key: "Vapp", expression: "(L:INI_VAPP_SPEED)" },
  { key: "transitionAltitude", expression: "(L:INI_transition_altitude)" },
  { key: "apuN1", expression: "(L:INI_APU_N1)" }
]

const RETRY_INTERVAL_MS = 5000
const STREAM_INTERVAL_MS = 16

export function useSimConnection() {
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const startStream = async () => {
      useTelemetryStore.getState().setStatus("connecting")
      try {
        // Always stop first to ensure a clean reconnect when the flight reloads.
        await invoke("stop_telemetry_stream").catch(() => {})
        await invoke("start_telemetry_stream", {
          variables: SIM_VARS,
          intervalMs: STREAM_INTERVAL_MS
        })
      } catch {
        useTelemetryStore.getState().setStatus("error")
      }
    }

    const stopStream = () => {
      if (retryRef.current) {
        clearInterval(retryRef.current)
        retryRef.current = null
      }
      invoke("stop_telemetry_stream").catch(() => {})
      useTelemetryStore.getState().setStatus("connecting")
    }

    // Retry logic: only active while a flight is loaded
    const startRetry = () => {
      if (retryRef.current) clearInterval(retryRef.current)
      retryRef.current = setInterval(() => {
        const current = useTelemetryStore.getState().status
        if (current !== "connected") {
          void startStream()
        }
      }, RETRY_INTERVAL_MS)
    }

    let unlistenFlightState: (() => void) | null = null
    const setupFlightStateListener = async () => {
      unlistenFlightState = await listen<boolean>("sim-in-flight", (event) => {
        if (event.payload) {
          // Flight loaded — restart the stream so LVARs register with correct slots
          void startStream()
          startRetry()
        } else {
          stopStream()
        }
      })

      // After the listener is registered, query whether we're already in the cockpit.
      // This handles the app being opened while already in a loaded flight — the Rust
      // side emits with a 300ms delay now, but this is a belt-and-suspenders fallback.
      const alreadyInCockpit = await invoke<boolean>("get_in_cockpit").catch(() => false)
      if (alreadyInCockpit) {
        void startStream()
        startRetry()
      }
    }
    void setupFlightStateListener()

    let unlistenTelemetry: (() => void) | null = null
    const setupTelemetryListener = async () => {
      unlistenTelemetry = await listen<Record<string, number>>("telemetry_data", (event) => {
        const s = useTelemetryStore.getState()
        s.setTelemetry(event.payload as Telemetry)
        if (s.status !== "connected") {
          s.setStatus("connected")
        }
      })
    }
    void setupTelemetryListener()

    let unlistenTitle: (() => void) | null = null
    const setupTitleListener = async () => {
      unlistenTitle = await listen<string>("simconnect-aircraft-title", (event) => {
        const title = typeof event.payload === "string" ? event.payload.trim() : ""
        if (title) {
          useTelemetryStore.getState().setAircraftTitle(title)
        }
      })
    }
    void setupTitleListener()

    getAircraftTitle()
      .then((cached) => {
        if (cached) {
          useTelemetryStore.getState().setAircraftTitle(cached)
        }
      })
      .catch(() => {})

    return () => {
      if (retryRef.current) {
        clearInterval(retryRef.current)
        retryRef.current = null
      }
      if (unlistenFlightState) unlistenFlightState()
      if (unlistenTelemetry) unlistenTelemetry()
      if (unlistenTitle) unlistenTitle()

      invoke("stop_telemetry_stream").catch(() => {})
    }
  }, [])
}
