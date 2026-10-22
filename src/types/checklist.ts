export interface ChecklistItem {
  label: string
  challenge?: string
  response?: string[]
  incorrect?: string
  copilot_response?: string
  baro_confirmation?: true
  takeoff_confirmation?: boolean
  validations?: ValidationRule[]
}

export interface Condition {
  responses?: string[]
  store?: { path: string; equals: string }
  always?: true
}

export interface Check {
  type: "simvar" | "store" | "any"
  var?: string
  expected?: number | boolean | { store: string }
  strict?: boolean
  store?: string
  equals?: string
  groups?: Check[][]
}

export interface ValidationRule {
  when: Condition
  checks?: Check[]
  incorrect?: string
  copilot_response?: string
}

export interface Checklist {
  id: string
  name: string
  items: ChecklistItem[]
  completion: string
}

export type ChecklistStepStatus = "pending" | "active" | "complete" | "failed"
export type ChecklistExecutionState = "idle" | "running" | "completed" | "error" | "aborted"
