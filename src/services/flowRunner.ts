import { simvarGet, simvarSet } from "@/API/simvarApi"
import { delay } from "@/lib/utils"
import { getFlowById, resolveFlow } from "@/services/flowLoader"
import { playSound, waitForSoundFinished } from "@/services/playSounds"
import { useCabinReadyTimerStore } from "@/store/cabinReadyTimerStore"
import { useFlowStore } from "@/store/flowStore"
import { usePerformanceStore } from "@/store/performanceStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTelemetryStore } from "@/store/telemetryStore"
import type { Telemetry } from "@/store/telemetryStore"
import { useVoiceHintProgressStore } from "@/store/voiceHintProgressStore"
import type { Flow, FlowStep, FlowConditionValue } from "@/types/flow"

import { moveFlapsLever } from "./flapsLever"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_DELAY = { MIN: 500, MAX: 1500 }
const SIMVAR = { READ_RETRIES: 5, READ_RETRY_DELAY: 150 }
const STEP_VERIFY = { RETRIES: 5, DELAY: 300, SOUND_AFTER_DELAY: 1000 }

const BLOCKED_FLOWS = new Set(["before_takeoff"])
const FUZZY_EPS = 0.5

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const getRandomStepDelay = () => Math.random() * (STEP_DELAY.MAX - STEP_DELAY.MIN) + STEP_DELAY.MIN
const fuzzyEquals = (a: number, b: number, eps = FUZZY_EPS) => Math.abs(a - b) < eps
const toNumber = (v: number | string) => (typeof v === "string" ? parseFloat(v) : v)

// ---------------------------------------------------------------------------
// SimVar I/O
// ---------------------------------------------------------------------------

async function readSimvar(expression: string): Promise<number | null> {
  for (let attempt = 0; attempt < SIMVAR.READ_RETRIES; attempt++) {
    try {
      const value = await simvarGet(expression)
      if (value !== null) return value
    } catch (err) {
      console.warn(`[FlowRunner] Failed to read "${expression}":`, err)
      return null
    }
    await delay(SIMVAR.READ_RETRY_DELAY)
  }
  return null
}

async function writeSimvar(expression: string): Promise<void> {
  try {
    await simvarSet(expression)
  } catch (err) {
    console.error(`[FlowRunner] Failed to write "${expression}":`, err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

function resolveFlowOption(path: string): unknown {
  const { takeoff, landing } = usePerformanceStore.getState()
  const { lightsControlMode } = useSettingsStore.getState()
  const root: Record<string, unknown> = {
    takeoff,
    landing,
    settings: { lightsControlMode }
  }
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined
    return (acc as Record<string, unknown>)[key]
  }, root)
}

function optionMatchesExpected(actual: unknown, expected: FlowConditionValue): boolean {
  if (typeof actual === "number" && typeof expected === "number") return fuzzyEquals(actual, expected)
  const a = Number(actual)
  const e = Number(expected)
  if (!Number.isNaN(a) && !Number.isNaN(e)) return fuzzyEquals(a, e)
  return String(actual) === String(expected)
}

function simvarMatchesExpected(actual: number | null, expected: FlowConditionValue, strict?: boolean): boolean {
  if (typeof expected !== "number" && typeof expected !== "string") return false
  if (strict) return actual !== null && Math.abs(actual - toNumber(expected)) < 0.01
  return actual !== null && fuzzyEquals(actual, toNumber(expected))
}

async function shouldExecuteStep(step: FlowStep): Promise<boolean> {
  const condition = step.only_if
  if (!condition) return true

  if ("option" in condition) {
    const optionValue = resolveFlowOption(condition.option)
    if (optionValue === undefined) {
      console.warn(`[FlowRunner] Step "${step.label}" condition option not found: "${condition.option}"`)
      return false
    }
    return condition.one_of.some((expected) => optionMatchesExpected(optionValue, expected))
  }

  const conditionValue = await readSimvar(condition.read)
  if (conditionValue === null) {
    console.warn(`[FlowRunner] Step "${step.label}" condition read failed for "${condition.read}"`)
    return false
  }

  return condition.one_of.some((expected) => simvarMatchesExpected(conditionValue, expected))
}

// ---------------------------------------------------------------------------
// Post-landing timer
// ---------------------------------------------------------------------------
// Reactive, chrono-driven: reacts to L:INI_CHRONO_TIME_FO changes via the telemetry
// store subscription instead of polling on a setTimeout. Re-arms itself
// automatically once the chrono resets to 0 for the next landing.

class PostLandingTimer {
  private active = false
  private expired = false
  private readonly THRESHOLD = 180
  public onReset?: () => void

  get isActive(): boolean {
    return this.active
  }

  constructor() {
    useTelemetryStore.subscribe((state) => {
      this.onTelemetry(state.telemetry)
    })
  }

  private onTelemetry(telemetry: Telemetry | null): void {
    if (!telemetry) return
    const chronoValue = telemetry.foChrono
    if (typeof chronoValue !== "number") return

    // Chrono reset to 0 — re-arm for the next landing
    if (chronoValue <= 0) {
      this.active = false
      this.expired = false
      this.onReset?.()
      return
    }

    if (this.expired) return

    if (chronoValue < this.THRESHOLD) {
      this.active = true
      return
    }

    this.active = false
    this.expired = true
    void this.fireExpiry()
  }

  private async fireExpiry(): Promise<void> {
    try {
      await simvarSet("1 (>L:INI_CHRONO_START_BUTTON_FO)")
    } catch (err) {
      console.error("[FlowRunner] Failed to fire chrono button:", err)
    }
    try {
      await playSound("three_minutes.ogg")
    } catch (err) {
      console.error("[FlowRunner] Failed to play post-landing expiry announcement:", err)
    }
  }
}

// ---------------------------------------------------------------------------
// Flow runner
// ---------------------------------------------------------------------------

class FlowRunner {
  private abortController: AbortController | null = null
  private lastCompletedFlow: string | null = null
  private parkingSoundPlayedThisCycle = false
  readonly postLandingTimer = new PostLandingTimer()

  constructor() {
    // Reset flags on timer reset
    this.postLandingTimer.onReset = () => {
      this.lastCompletedFlow = null
      this.parkingSoundPlayedThisCycle = false
    }

    // SCENARIO 1: Real-time telemetry check (independent of running flows)
    useTelemetryStore.subscribe((state) => {
      void this.checkParkingBrakeAndTaxiLight(state.telemetry)
    })
  }

  // ── Scenario 1: Real-time telemetry monitoring ────────────────────────────

  private async checkParkingBrakeAndTaxiLight(telemetry: Telemetry | null): Promise<void> {
    if (!telemetry) return

    // Respect the same setting that gates Scenario 2 — if the post-landing
    // shutdown guard is off, don't proactively nag either.
    const { postLandingShutdownEnabled } = useSettingsStore.getState()
    if (!postLandingShutdownEnabled) return

    // Check conditions: after_landing was last, timer active, brake ON, taxi light OFF (2)
    if (
      this.lastCompletedFlow === "after_landing" &&
      this.postLandingTimer.isActive &&
      !this.parkingSoundPlayedThisCycle &&
      telemetry.parkingBrake > 0.5 &&
      telemetry.taxiLight === 2
    ) {
      this.parkingSoundPlayedThisCycle = true // Play once per cycle
      await playSound("three_minutes_not_passed.ogg")
    }
  }

  // ── Scenario 2: Precondition guard on flow execution ─────────────────────

  private async checkPreconditions(flowId: string): Promise<string | null> {
    if (useCabinReadyTimerStore.getState().isRunning && BLOCKED_FLOWS.has(flowId)) {
      playSound("cabin_not_secure.ogg")
      return "Cannot start before takeoff flow - cabin ready timer is running"
    }
    return null
  }

  // ── Public API ────────────────────────────────────────────────────────────

  abort(): void {
    this.abortController?.abort()
    this.abortController = null
    useFlowStore.getState().setExecutionState("aborted")
  }

  async execute(flowId: string): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    const store = useFlowStore.getState()
    const rawFlow = getFlowById(flowId)
    if (!rawFlow) {
      store.setError(`Flow "${flowId}" not found`)
      return
    }

    // Scenario 2 check: blocks flow & plays sound if cabin timer is running
    const preconditionError = await this.checkPreconditions(flowId)
    if (preconditionError) {
      return
    }

    const flow: Flow = await resolveFlow(rawFlow)
    store.setFlow(flow)
    store.setExecutionState("running")

    this.abortController = new AbortController()
    const { signal } = this.abortController

    try {
      await this.playFlowStartSound(flow, signal)
      await this.runSteps(flow, signal)

      useFlowStore.getState().setExecutionState("completed")
      this.onFlowCompleted(flow)

      await this.playFlowEndSound(flow)
    } catch (err) {
      if (signal.aborted) {
        useFlowStore.getState().setExecutionState("aborted")
      } else {
        useFlowStore.getState().setError(err instanceof Error ? err.message : String(err))
        useFlowStore.getState().setExecutionState("error")
      }
    } finally {
      this.abortController = null
    }
  }

  // ── Step iteration ────────────────────────────────────────────────────────

  private async runSteps(flow: Flow, signal: AbortSignal): Promise<void> {
    const { setStepIndex, setStepStatus } = useFlowStore.getState()
    const lastIdx = flow.steps.length - 1

    for (let i = 0; i <= lastIdx; i++) {
      this.checkAbort(signal)
      const step = flow.steps[i]
      setStepIndex(i)
      setStepStatus(i, "executing")

      if (!(await shouldExecuteStep(step))) {
        setStepStatus(i, "skipped")
        if (i < lastIdx && !step.skip_delay) await this.abortableSleep(getRandomStepDelay(), signal)
        continue
      }

      await this.executeStep(step, i, flow, signal)
      if (i < lastIdx && !step.skip_delay) await this.abortableSleep(getRandomStepDelay(), signal)
    }
  }

  // ── Single step execution ─────────────────────────────────────────────────

  private async executeStep(step: FlowStep, index: number, flow: Flow, signal: AbortSignal): Promise<void> {
    const { setStepStatus } = useFlowStore.getState()

    if (index > 0 && flow.steps[index - 1]?.skip_delay) {
      await this.abortableSleep(100, signal)
    }

    const expectedValue = toNumber(step.expect)
    const currentValue = await readSimvar(step.read)
    this.checkAbort(signal)

    console.log(`[FlowRunner] Step "${step.label}": read=${currentValue}, expect=${step.expect}`)

    if (simvarMatchesExpected(currentValue, step.expect, step.strict_verify)) {
      if (step.wait_ms) await this.abortableSleep(step.wait_ms, signal)
      setStepStatus(index, "skipped")
      return
    }
    if (step.flaps_lever) await moveFlapsLever(expectedValue)

    await writeSimvar(step.on)
    this.checkAbort(signal)

    await this.handlePostWrite(step, signal)
    await this.verifyAndFinish(step, index, signal)
  }

  // ── Post-write phase ──────────────────────────────────────────────────────

  private async handlePostWrite(step: FlowStep, signal: AbortSignal): Promise<void> {
    if (step.sound_on_execute) await this.playSyncSound(step.sound_on_execute, signal)

    if (step.hold_ms) {
      await this.abortableSleep(step.hold_ms, signal)
      const releaseExpr = step.on.replace(/^-?\d+\s+/, "0 ")
      await writeSimvar(releaseExpr)
      this.checkAbort(signal)
    }

    if (step.wait_ms) await this.abortableSleep(step.wait_ms, signal)
  }

  // ── Verify phase ──────────────────────────────────────────────────────────

  private async verifyAndFinish(step: FlowStep, index: number, signal: AbortSignal): Promise<void> {
    const { setStepStatus } = useFlowStore.getState()

    if (step.skip_verify) {
      setStepStatus(index, "done")
      await this.playSoundAfterExecute(step, signal)
      return
    }

    setStepStatus(index, "verifying")

    let verified = false
    for (let attempt = 0; attempt < STEP_VERIFY.RETRIES; attempt++) {
      this.checkAbort(signal)
      if (!step.skip_delay) await delay(STEP_VERIFY.DELAY)
      const newValue = await readSimvar(step.read)
      if (simvarMatchesExpected(newValue, step.expect, step.strict_verify)) {
        verified = true
        break
      }
    }

    if (!verified) {
      console.warn(`[FlowRunner] Step "${step.label}" verification failed (expected ${step.expect})`)
      setStepStatus(index, "failed")
      return
    }

    setStepStatus(index, "done")
    await this.playSoundAfterExecute(step, signal)
  }

  // ── Sound helpers ─────────────────────────────────────────────────────────

  private async playSyncSound(soundFile: string, signal?: AbortSignal): Promise<void> {
    await waitForSoundFinished()
    await playSound(soundFile)
    await waitForSoundFinished()
    if (signal) this.checkAbort(signal)
  }

  private async playFlowStartSound(flow: Flow, signal: AbortSignal): Promise<void> {
    if (flow.sound_start) await this.playSyncSound(flow.sound_start, signal)
  }

  private async playFlowEndSound(flow: Flow): Promise<void> {
    if (flow.sound_end) await this.playSyncSound(flow.sound_end)
  }

  private async playSoundAfterExecute(step: FlowStep, signal: AbortSignal): Promise<void> {
    if (!step.sound_after_execute) return
    if (!step.skip_delay) await this.abortableSleep(STEP_VERIFY.SOUND_AFTER_DELAY, signal)
    await this.playSyncSound(step.sound_after_execute, signal)
  }

  // ── Flow completion side-effects ──────────────────────────────────────────

  private onFlowCompleted(flow: Flow): void {
    this.lastCompletedFlow = flow.id // Track last executed flow ID for Scenario 1
    const voiceHints = useVoiceHintProgressStore.getState()
    voiceHints.recordFlowCompleted(flow.id)
  }

  // ── Abort / sleep helpers ─────────────────────────────────────────────────

  private checkAbort(signal: AbortSignal): void {
    if (signal.aborted) throw new Error("Flow aborted")
  }

  private async abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      this.checkAbort(signal)
      await delay(Math.min(100, ms - elapsed))
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton + public API
// ---------------------------------------------------------------------------

const runner = new FlowRunner()

export const executeFlow = (flowId: string): Promise<void> => runner.execute(flowId)
export const abortFlow = (): void => runner.abort()
export const isPostLandingTimerActive = (): boolean => runner.postLandingTimer.isActive
