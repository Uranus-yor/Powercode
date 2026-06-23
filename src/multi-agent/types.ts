// ========== 策略类型 ==========

export type Strategy = 'single' | 'parallel' | 'sequential'
export type OutputMode = 'stream' | 'collect'

// ========== 任务计划 ==========

export type TaskPlan = {
  strategy: Strategy
  outputMode: OutputMode
  reason: string
  tasks: SubTask[]
  answer?: string
}

// ========== 子任务 ==========

export type SubTask = {
  id: string
  description: string
  tools: string[]
  depends_on: string[]
  target_files?: string[]
  role?: string
}

// ========== Agent 状态 ==========

export type AgentStatus = {
  id: string
  label: string
  task: string
  status: AgentState
  current_tool?: string
  result_summary?: string
}

export type AgentState = 'pending' | 'waiting' | 'running' | 'done' | 'error'

// ========== Agent 事件 ==========

export type AgentEvent =
  | AgentStartedEvent
  | AgentProgressEvent
  | AgentCompletedEvent
  | AgentErrorEvent

export type AgentStartedEvent = {
  type: 'started'
  agentId: string
  task: string
  timestamp: number
}

export type AgentProgressEvent = {
  type: 'progress'
  agentId: string
  toolName?: string
  message?: string
  timestamp: number
}

export type AgentCompletedEvent = {
  type: 'completed'
  agentId: string
  result: AgentResult
  timestamp: number
}

export type AgentErrorEvent = {
  type: 'error'
  agentId: string
  error: string
  timestamp: number
}

// ========== Agent 结果 ==========

export type AgentResult = {
  agentId: string
  success: boolean
  output: string
  toolCalls: number
  duration: number
  error?: string
}
