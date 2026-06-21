import type { ToolRegistry } from './tool-registry.js'
import type {
  ChatMessage,
  CompressionResult,
  ModelAdapter,
  ProviderThinkingBlock,
  ProviderUsage,
  ContextCollapseResult,
  ContextCollapseState,
  SnipCompactResult,
  ContextStats,
  ContentReplacementState,
  PendingToolResult,
} from './types.js'
import type { PermissionManager } from '../permissions.js'
import { microcompact } from '../compact/microcompact.js'
import { autoCompact } from '../compact/auto-compact.js'
import {
  applyContextCollapseIfNeeded,
  createContextCollapseState,
} from '../compact/context-collapse.js'
import {
  snipCompactConversation,
} from '../compact/snipCompact.js'
import { computeContextStats } from '../utils/token-estimator.js'
import {
  applyToolResultBudget,
  createContentReplacementState,
  replaceLargeToolResult,
} from '../utils/tool-result-storage.js'
import {
  isEmptyAssistantResponse,
  addProviderUsage,
  parseAssistantText,
} from './message-utils.js'
import {
  shouldRetryEmptyResponse,
  shouldRetryThinkingStop,
  buildRetryPrompt,
  buildThinkingRetryPrompt,
  buildEmptyResponseMessage,
} from './retry-handler.js'
import {
  isProgressUpdate,
  buildProgressContinuationPrompt,
} from './progress-handler.js'

// ========== 辅助函数 ==========

function appendThinkingBlocks(
  messages: ChatMessage[],
  blocks: ProviderThinkingBlock[] | undefined,
): ChatMessage[] {
  if (!blocks || blocks.length === 0) return messages
  return [
    ...messages,
    {
      role: 'assistant_thinking' as const,
      blocks,
    },
  ]
}

function pushContinuationPrompt(
  messages: ChatMessage[],
  content: string,
): ChatMessage[] {
  return [
    ...messages,
    {
      role: 'user' as const,
      content,
    },
  ]
}

// ========== 主循环选项 ==========

export type AgentLoopOptions = {
  model: ModelAdapter
  tools: ToolRegistry
  messages: ChatMessage[]
  cwd: string
  permissions?: PermissionManager
  maxSteps?: number
  modelName?: string
  onToolStart?: (toolName: string, input: unknown) => void
  onToolResult?: (toolName: string, output: string, isError: boolean) => void
  onAssistantMessage?: (content: string) => void
  onProgressMessage?: (content: string) => void
  onAutoCompact?: (result: CompressionResult) => void | Promise<void>
  onSnipCompact?: (result: SnipCompactResult) => void | Promise<void>
  onContextCollapse?: (result: ContextCollapseResult) => void | Promise<void>
  onContextStats?: (stats: ContextStats) => void
  contentReplacementState?: ContentReplacementState
  contextCollapseState?: ContextCollapseState
}

// ========== 主循环 ==========

export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<ChatMessage[]> {
  const {
    model,
    tools,
    messages: initialMessages,
    cwd,
    permissions,
    maxSteps,
    modelName,
    onToolStart,
    onToolResult,
    onAssistantMessage,
    onProgressMessage,
    onAutoCompact,
    onSnipCompact,
    onContextCollapse,
    onContextStats,
    contentReplacementState,
    contextCollapseState,
  } = options

  let messages = initialMessages
  let emptyResponseCount = 0
  let thinkingRetryCount = 0
  let toolErrorCount = 0
  let sawToolResultThisTurn = false
  let snippedThisTurn = false
  const contentReplState = contentReplacementState ?? createContentReplacementState()
  let ctxCollapseState = contextCollapseState ?? createContextCollapseState()

  const replaceContextCollapseState = (nextState: ContextCollapseState) => {
    ctxCollapseState = nextState
    if (contextCollapseState) {
      contextCollapseState.spans = [...nextState.spans]
      contextCollapseState.enabled = nextState.enabled
      contextCollapseState.consecutiveFailures = nextState.consecutiveFailures
    }
  }

  for (let step = 0; maxSteps == null || step < maxSteps; step++) {
    // 更新 system prompt 中的日期信息
    if (messages[0]?.role === 'system') {
      const today = new Date().toISOString().split('T')[0]
      const systemContent = messages[0].content as string
      // 替换日期信息
      messages[0] = {
        ...messages[0],
        content: systemContent.replace(
          /Current date: \d{4}-\d{2}-\d{2}/,
          `Current date: ${today}`,
        ),
      }
    }

    let latestStats: ContextStats | null = null
    let modelMessages = messages

    if (modelName) {
      latestStats = computeContextStats(messages, modelName)

      if (!snippedThisTurn) {
        const snipResult = await snipCompactConversation({
          messages,
          contextStats: latestStats,
          modelContextWindow: latestStats.effectiveInput,
        })
        if (snipResult.didSnip) {
          messages = snipResult.messages
          snippedThisTurn = true
          await onSnipCompact?.(snipResult)
          latestStats = computeContextStats(messages, modelName)
          onContextStats?.(latestStats)
        }
      }

      const beforeMicrocompact = messages
      messages = microcompact(messages, modelName)
      if (messages !== beforeMicrocompact) {
        latestStats = computeContextStats(messages, modelName)
        onContextStats?.(latestStats)
      }

      const collapseResult = await applyContextCollapseIfNeeded(
        messages,
        modelName,
        model,
        ctxCollapseState,
      )
      replaceContextCollapseState(collapseResult.state)
      modelMessages = collapseResult.messages
      if (collapseResult.collapsed) {
        await onContextCollapse?.(collapseResult)
        latestStats = computeContextStats(modelMessages, modelName)
        onContextStats?.(latestStats)
      } else if (modelMessages !== messages) {
        latestStats = computeContextStats(modelMessages, modelName)
        onContextStats?.(latestStats)
      }
    }

    // AutoCompact: LLM-based compression when context is critical (first step only)
    if (step === 0 && modelName) {
      latestStats = latestStats ?? computeContextStats(modelMessages, modelName)
      onContextStats?.(latestStats)
      if (latestStats.warningLevel === 'critical' || latestStats.warningLevel === 'blocked') {
        const result = await autoCompact(modelMessages, modelName, model)
        if (result) {
          messages = result.messages
          modelMessages = messages
          replaceContextCollapseState(createContextCollapseState())
          await onAutoCompact?.(result)
          latestStats = computeContextStats(messages, modelName)
          onContextStats?.(latestStats)
        }
      }
    }

    // 调用模型
    const next = await model.next(modelMessages)

    // 处理助手响应（无工具调用）
    if (next.type === 'assistant') {
      const isEmpty = isEmptyAssistantResponse(next.content)

      // 检查是否是进度消息
      if (
        !isEmpty &&
        isProgressUpdate({
          kind: next.kind,
          content: next.content,
          sawToolResultThisTurn,
        })
      ) {
        onProgressMessage?.(next.content)
        messages = appendThinkingBlocks(messages, next.thinkingBlocks)
        messages = [
          ...messages,
          { role: 'assistant_progress', content: next.content },
        ]
        messages = pushContinuationPrompt(
          messages,
          buildProgressContinuationPrompt(sawToolResultThisTurn),
        )
        continue
      }

      // 检查是否需要重试 thinking 停止
      if (
        shouldRetryThinkingStop({
          isEmpty,
          stopReason: next.diagnostics?.stopReason,
          blockTypes: next.diagnostics?.blockTypes,
          ignoredBlockTypes: next.diagnostics?.ignoredBlockTypes,
        }) &&
        thinkingRetryCount < 3
      ) {
        thinkingRetryCount += 1
        const progressContent = buildThinkingRetryPrompt(
          next.diagnostics?.stopReason,
        )
        onProgressMessage?.(progressContent)
        messages = appendThinkingBlocks(messages, next.thinkingBlocks)
        messages = [
          ...messages,
          { role: 'assistant_progress', content: progressContent },
        ]
        messages = pushContinuationPrompt(
          messages,
          buildThinkingRetryPrompt(next.diagnostics?.stopReason),
        )
        continue
      }

      // 检查是否需要重试空响应
      if (isEmpty && shouldRetryEmptyResponse({ emptyResponseCount, thinkingRetryCount, toolErrorCount, sawToolResult: sawToolResultThisTurn })) {
        emptyResponseCount += 1
        messages = pushContinuationPrompt(
          messages,
          buildRetryPrompt(sawToolResultThisTurn),
        )
        continue
      }

      // 空响应且无法重试
      if (isEmpty) {
        const fallbackContent = buildEmptyResponseMessage({
          sawToolResult: sawToolResultThisTurn,
          toolErrorCount,
          diagnostics: next.diagnostics,
        })
        onAssistantMessage?.(fallbackContent)
        messages = appendThinkingBlocks(messages, next.thinkingBlocks)
        return [
          ...messages,
          {
            role: 'assistant',
            content: fallbackContent,
          },
        ]
      }

      // 正常助手响应
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: next.content,
      }
      messages = appendThinkingBlocks(messages, next.thinkingBlocks)
      const withAssistant: ChatMessage[] = [
        ...messages,
        addProviderUsage(assistantMessage, next.usage),
      ]

      if (!isEmpty) {
        onAssistantMessage?.(next.content)
      }

      return withAssistant
    }

    // 处理工具调用
    messages = appendThinkingBlocks(messages, next.thinkingBlocks)

    if (next.content) {
      if (next.contentKind === 'progress') {
        onProgressMessage?.(next.content)
        messages = [
          ...messages,
          addProviderUsage(
            { role: 'assistant_progress', content: next.content },
            next.usage,
          ),
        ]
        messages = pushContinuationPrompt(
          messages,
          buildProgressContinuationPrompt(false),
        )
      } else {
        onAssistantMessage?.(next.content)
        messages = [
          ...messages,
          addProviderUsage(
            { role: 'assistant', content: next.content },
            (next.calls?.length ?? 0) > 0 ? undefined : next.usage,
          ),
        ]
      }
    }

    if ((next.calls?.length ?? 0) === 0 && next.content && next.contentKind !== 'progress') {
      return messages
    }

    // 执行工具调用
    const executedToolResults: Array<{
      call: (typeof next.calls)[number]
      result: Awaited<ReturnType<ToolRegistry['execute']>>
      toolResult: PendingToolResult
    }> = []

    for (const call of next.calls) {
      onToolStart?.(call.toolName, call.input)
      const result = await tools.execute(
        call.toolName,
        call.input,
        { cwd, permissions },
      )
      sawToolResultThisTurn = true
      if (!result.ok) {
        toolErrorCount += 1
      }
      onToolResult?.(call.toolName, result.output, !result.ok)

      const toolResult = await replaceLargeToolResult({
        role: 'tool_result',
        toolUseId: call.id,
        toolName: call.toolName,
        content: result.output,
        isError: !result.ok,
      }, contentReplState)

      executedToolResults.push({
        call,
        result,
        toolResult,
      })
    }

    // 应用工具结果预算
    const budgetedResults = await applyToolResultBudget(
      executedToolResults.map(entry => entry.toolResult),
      contentReplState,
    )
    const toolResultById = new Map(
      budgetedResults.results.map(result => [result.toolUseId, result]),
    )

    // 构建工具调用消息
    const toolCallMessages = executedToolResults.map((entry, i) => {
      const toolCallMessage: ChatMessage = {
        role: 'assistant_tool_call',
        toolUseId: entry.call.id,
        toolName: entry.call.toolName,
        input: entry.call.input,
      }

      return addProviderUsage(
        toolCallMessage,
        i === executedToolResults.length - 1 ? next.usage : undefined,
      )
    })
    const toolResults = executedToolResults.map(entry =>
      toolResultById.get(entry.call.id) ?? entry.toolResult,
    )

    messages = [
      ...messages,
      ...toolCallMessages,
      ...toolResults,
    ]

    // 检查是否需要等待用户输入
    const awaitUserEntry = executedToolResults.find(entry => entry.result.awaitUser)
    if (awaitUserEntry) {
      const question = awaitUserEntry.result.output.trim()
      if (question.length > 0) {
        onAssistantMessage?.(question)
        messages = [
          ...messages,
          {
            role: 'assistant',
            content: question,
          },
        ]
      }
      return messages
    }
  }

  // 达到最大步数
  const maxStepContent = `达到最大工具步数限制，已停止当前回合。`
  onAssistantMessage?.(maxStepContent)
  return [
    ...messages,
    {
      role: 'assistant',
      content: maxStepContent,
    },
  ]
}
