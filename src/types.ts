// Re-export from core module for backward compatibility
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
} from './core/types.js'

// Backward compatibility aliases
export type { ModelResponse as AgentStep } from './core/types.js'
export type { ThinkingBlock as ProviderThinkingBlock } from './core/types.js'
export type { ResponseDiagnostics as StepDiagnostics } from './core/types.js'
