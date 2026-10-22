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
  { key: "locDeviation", expression: "(L:A310_LOCALIZER_DOTS)" },
  { key: "glideDeviation", expression: "(L:A310_GLIDESLOPE_ERROR_DOTS)" },
  { key: "locValid", expression: "(L:A310_RADIO_RECIEVER_LOC_IS_VALID)" },
  { key: "glideValid", expression: "(L:A310_RADIO_RECIEVER_GLIDESLOPE_VALID)" },
  { key: "iniFlexTemperature", expression: "(L:A310_FLEX_TEMPERATURE)" },
  { key: "iniThrustFlexN1", expression: "(L:A310_THRUST_FLEX_N1)" },
  { key: "iniThrustTogaN1", expression: "(L:A310_THRUST_TOGA_N1)" },
  { key: "iniFdOnCM1", expression: "(L:A310_FDIR_SWITCH_CAPT)" },
  { key: "iniFdOnCM2", expression: "(L:A310_FDIR_SWITCH_FO)" },
  { key: "efisQnhUnitSelectorLeft", expression: "(A:EFIS_QNH_UNIT_SELECTOR_LEFT, Bool)" },
  { key: "captAltimeterSettingMB", expression: "(A:KOHLSMAN SETTING MB:1, Millibars)" },
  { key: "captAltimeterSettingHG", expression: "(A:KOHLSMAN SETTING HG:1, inHg)" },
  { key: "foAltimeterSettingMB", expression: "(A:KOHLSMAN SETTING MB:2, Millibars)" },
  { key: "foAltimeterSettingHG", expression: "(A:KOHLSMAN SETTING HG:2, inHg)" },
  { key: "totalFuelQuantityWeight", expression: "(A:FUEL TOTAL QUANTITY WEIGHT, Pounds)" },
  { key: "iniEngAntiIce1State", expression: "(L:A310_ENG1_ANTI_ICE)" },
  { key: "iniEngAntiIce2State", expression: "(L:A310_ENG2_ANTI_ICE)" },
  { key: "iniWingAntiIce1State", expression: "(L:A310_WING_ANTI_ICE)" },
  { key: "iniAirPack1Button", expression: "(L:A300_PACK1_BUTTON, Bool)" },
  { key: "iniAirPack2Button", expression: "(L:A300_PACK2_BUTTON, Bool)" },
  { key: "ignitionKnob", expression: "(L:A310_eng_ignition_switch)" },
  { key: "flapsIndex", expression: "(A:FLAPS HANDLE INDEX,Number)" },
  { key: "mixture1", expression: "(L:A310_MIXTURE_RATIO1_HANDLE)" },
  { key: "mixture2", expression: "(L:A310_MIXTURE_RATIO2_HANDLE)" },
  { key: "spoilersArmed", expression: "(L:A310_SPOILERS_ARMED)" },
  { key: "fcuAlt", expression: "(L:A310_Altitude_Dial)" },
  { key: "cptBaro", expression: "(L:XMLVAR_BARO_Selector_HPA_1)" },
  { key: "foBaro", expression: "(L:XMLVAR_BARO_Selector_HPA_2)" },
  { key: "stbBaro", expression: "(L:XMLVAR_BARO_Selector_HPA_3)" },
  { key: "linkedInstruments", expression: "(L:INI_LINKED_INSTRUMENTS)" },
  { key: "arrRunwayHdg", expression: "(L:A310_ARR_RUNWAY_HDG)" },
  { key: "foShowAirports", expression: "(L:INI_SHOW_AIRPORTS2)" },
  { key: "foShowConstraints", expression: "(L:INI_SHOW_CONSTRAINTS2)" },
  { key: "foVor1Active", expression: "(L:INI_FO_VOR1_ACTIVE)" },
  { key: "foVor2Active", expression: "(L:INI_FO_VOR2_ACTIVE)" },
  { key: "foTerrOn", expression: "(L:INI_TERR_ON_FO)" },
  { key: "foWxr2On", expression: "(L:INI_WXR2_ON)" },
  { key: "v1", expression: "(L:A310_V1)" },
  { key: "vr", expression: "(L:A310_VR)" },
  { key: "autobrakeLevel", expression: "(L:A310_AUTOBRAKE_LEVEL)" },
  { key: "thrustReductionAlt", expression: "(L:A310_REDUCTION_ALTITUDE)" },
  { key: "mda", expression: "(L:A310_FMS_MDA)" },
  { key: "dh", expression: "(L:A310_MINIMUMS_PILOT)" },
  { key: "engine1Reverse", expression: "(L:A310_REVERSE1_HANDLE_PERCENT)" },
  { key: "engine2Reverse", expression: "(L:A310_REVERSE2_HANDLE_PERCENT)" },
  { key: "thrustRatingMode", expression: "(L:A310_TRP_MODE)" },
  { key: "foChrono", expression: "(L:A300DR_CHRONO_TIME_FO)" },
  { key: "taxiLight", expression: "(L:A310_TAXI_LIGHTS_SWITCH)" },
  { key: "baroMode", expression: "(L:XMLVAR_Baro1_Mode)" },
  { key: "gdSpeed", expression: "(L:A310_Greendot_speed)" },
  { key: "sSpeed", expression: "(L:A310_S_SPEED)" },
  { key: "fSpeed", expression: "(L:A310_F_SPEED)" },
  { key: "Vapp", expression: "(L:A310_VAPP_SPEED)" }
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
