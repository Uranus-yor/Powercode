// ========== 类型导出 ==========

export type {
  MessageRole,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ProgressMessage,
  ThinkingMessage,
  ToolCallMessage,
  ToolResultMessage,
  ContextSummaryMessage,
  SnipBoundaryMessage,
  ChatMessage,
  ModelResponse,
  AssistantResponse,
  ToolCallResponse,
  ToolCall,
  ToolResult,
  BackgroundTask,
  ProviderUsage,
  ResponseDiagnostics,
  ThinkingBlock,
  ModelAdapter,
  CompressionResult,
  SnipCompactResult,
  ContextCollapseResult,
  CollapseSpan,
  ContextCollapseState,
  ContextStats,
  ContentReplacementState,
  PendingToolResult,
} from './types.js'

// ========== 工具注册表导出 ==========

export { ToolRegistry } from './tool-registry.js'
export type {
  ToolContext,
  ToolDefinition,
  ToolMetadata,
} from './tool-registry.js'

// ========== 主循环导出 ==========

export { runAgentLoop } from './agent-loop.js'
export type { AgentLoopOptions } from './agent-loop.js'

// ========== 消息工具导出 ==========

export {
  isEmptyAssistantResponse,
  isProgressMessage,
  isFinalMessage,
  extractMessageKind,
  addProviderUsage,
  parseAssistantText,
} from './message-utils.js'

// ========== 重试处理导出 ==========

export {
  shouldRetryEmptyResponse,
  shouldRetryThinkingStop,
  buildRetryPrompt,
  buildThinkingRetryPrompt,
  formatDiagnostics,
  buildEmptyResponseMessage,
} from './retry-handler.js'
export type { RetryState } from './retry-handler.js'

// ========== 进度处理导出 ==========

export {
  handleProgressMessage,
  buildProgressContinuationPrompt,
  isProgressUpdate,
} from './progress-handler.js'
