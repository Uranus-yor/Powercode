// ========== 消息角色 ==========

export type MessageRole =
  | 'system'
  | 'user'
  | 'assistant'
  | 'assistant_thinking'
  | 'assistant_progress'
  | 'assistant_tool_call'
  | 'tool_result'
  | 'context_summary'
  | 'snip_boundary'

// ========== 基础消息 ==========

export type SystemMessage = {
  role: 'system'
  content: string
  id?: string
}

export type UserMessage = {
  role: 'user'
  content: string
  id?: string
}

export type AssistantMessage = {
  role: 'assistant'
  content: string
  providerUsage?: ProviderUsage
  usageStale?: boolean
  usageStaleReason?: string
  id?: string
}

export type ProgressMessage = {
  role: 'assistant_progress'
  content: string
  providerUsage?: ProviderUsage
  usageStale?: boolean
  usageStaleReason?: string
  id?: string
}

export type ThinkingMessage = {
  role: 'assistant_thinking'
  blocks: ThinkingBlock[]
  id?: string
}

export type ToolCallMessage = {
  role: 'assistant_tool_call'
  toolUseId: string
  toolName: string
  input: unknown
  providerUsage?: ProviderUsage
  usageStale?: boolean
  usageStaleReason?: string
  id?: string
}

export type ToolResultMessage = {
  role: 'tool_result'
  toolUseId: string
  toolName: string
  content: string
  isError: boolean
  id?: string
}

export type ContextSummaryMessage = {
  role: 'context_summary'
  content: string
  compressedCount: number
  timestamp: number
  id?: string
}

export type SnipBoundaryMessage = {
  role: 'snip_boundary'
  content: string
  removedMessageIds: string[]
  removedCount: number
  tokensFreed: number
  timestamp: number
  id?: string
}

// ========== 联合类型 ==========

export type ChatMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ProgressMessage
  | ThinkingMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSummaryMessage
  | SnipBoundaryMessage

// ========== 模型响应 ==========

export type ModelResponse =
  | AssistantResponse
  | ToolCallResponse

export type AssistantResponse = {
  type: 'assistant'
  content: string
  kind?: 'final' | 'progress'
  thinkingBlocks?: ThinkingBlock[]
  diagnostics?: ResponseDiagnostics
  usage?: ProviderUsage
}

export type ToolCallResponse = {
  type: 'tool_calls'
  calls: ToolCall[]
  content?: string
  contentKind?: 'progress'
  thinkingBlocks?: ThinkingBlock[]
  diagnostics?: ResponseDiagnostics
  usage?: ProviderUsage
}

// ========== 工具相关 ==========

export type ToolCall = {
  id: string
  toolName: string
  input: unknown
}

export type ToolResult = {
  ok: boolean
  output: string
  backgroundTask?: BackgroundTask
  awaitUser?: boolean
}

export type BackgroundTask = {
  taskId: string
  type: 'local_bash'
  command: string
  pid: number
  status: 'running' | 'completed' | 'failed'
  startedAt: number
}

// ========== 使用量 ==========

export type ProviderUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  source: string
}

// ========== 诊断 ==========

export type ResponseDiagnostics = {
  stopReason?: string
  blockTypes?: string[]
  ignoredBlockTypes?: string[]
}

// ========== 思考块 ==========

export type ThinkingBlock = {
  type: 'thinking' | 'redacted_thinking'
  [key: string]: unknown
}

// 向后兼容别名
export type ProviderThinkingBlock = ThinkingBlock

// ========== 模型适配器 ==========

export interface ModelAdapter {
  next(messages: ChatMessage[]): Promise<ModelResponse>
}

// ========== 压缩结果 ==========

export type CompressionResult = {
  messages: ChatMessage[]
  summary: ContextSummaryMessage
  removedCount: number
  tokensBefore: number
  tokensAfter: number
}

export type SnipCompactResult = {
  messages: ChatMessage[]
  didSnip: boolean
  tokensBefore: number
  tokensAfter: number
  tokensFreed: number
  removedMessageIds: string[]
  boundaryMessage?: ChatMessage
  reason?: string
}

export type ContextCollapseResult = {
  messages: ChatMessage[]
  collapsed: boolean
  spans: CollapseSpan[]
  state: ContextCollapseState
}

export type CollapseSpan = {
  id: string
  startMessageId: string
  endMessageId: string
  messageIds: string[]
  summary: string
  tokensBefore: number
  tokensAfter: number
  status: 'staged' | 'committed'
  createdAt: number
  reason: 'context_pressure' | 'manual' | 'overflow_recovery'
}

export type ContextCollapseState = {
  spans: CollapseSpan[]
  enabled: boolean
  consecutiveFailures: number
}

export type ContextStats = {
  estimatedTokens: number
  totalTokens: number
  providerUsageTokens: number
  contextWindow: number
  effectiveInput: number
  utilization: number
  warningLevel: 'normal' | 'warning' | 'critical' | 'blocked'
  accounting: {
    source: 'provider_usage' | 'provider_usage_plus_estimate' | 'estimate_only'
    totalTokens: number
    providerUsageTokens: number
    estimatedTokens: number
    isExact: boolean
    usageBoundary?: {
      messageIndex: number
      messageId?: string
    }
    stale?: boolean
    reason?: string
  }
}

export type ContentReplacementState = {
  seenIds: Set<string>
  replacements: Map<string, string>
}

export type PendingToolResult = {
  role: 'tool_result'
  toolUseId: string
  toolName: string
  content: string
  isError: boolean
}
