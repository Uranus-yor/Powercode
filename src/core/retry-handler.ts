// ========== 重试状态 ==========

export type RetryState = {
  emptyResponseCount: number
  thinkingRetryCount: number
  toolErrorCount: number
  sawToolResult: boolean
}

// ========== 重试判断 ==========

export function shouldRetryEmptyResponse(state: RetryState): boolean {
  return state.emptyResponseCount < 2
}

export function shouldRetryThinkingStop(args: {
  isEmpty: boolean
  stopReason?: string
  blockTypes?: string[]
  ignoredBlockTypes?: string[]
}): boolean {
  if (!args.isEmpty) return false
  if (args.stopReason !== 'pause_turn' && args.stopReason !== 'max_tokens') {
    return false
  }
  return (
    (args.blockTypes ?? []).includes('thinking') ||
    (args.ignoredBlockTypes ?? []).includes('thinking')
  )
}

// ========== 重试提示 ==========

export function buildRetryPrompt(
  sawToolResult: boolean,
  stopReason?: string,
): string {
  if (stopReason === 'max_tokens') {
    return 'Your previous response hit max_tokens during thinking before producing the next actionable step. Resume immediately and continue with the next concrete tool call, code change, or an explicit <final> answer only if the task is complete. Do not repeat the earlier plan.'
  }
  if (sawToolResult) {
    return 'Your last response was empty after recent tool results. Continue immediately by trying the next concrete step, adapting to any tool errors, or giving an explicit <final> answer only if the task is complete.'
  }
  return 'Your last response was empty. Continue immediately with concrete tool calls, code changes, or an explicit <final> answer only if the task is complete.'
}

export function buildThinkingRetryPrompt(stopReason?: string): string {
  if (stopReason === 'max_tokens') {
    return 'Your previous response hit max_tokens during thinking before producing the next actionable step. Resume immediately and continue with the next concrete tool call, code change, or an explicit <final> answer only if the task is complete. Do not repeat the earlier plan.'
  }
  return 'Resume from the previous pause_turn and continue the task immediately. Produce the next concrete tool call, code change, or an explicit <final> answer only if the task is complete.'
}

// ========== 诊断格式化 ==========

export function formatDiagnostics(args: {
  stopReason?: string
  blockTypes?: string[]
  ignoredBlockTypes?: string[]
}): string {
  const parts: string[] = []

  if (args.stopReason) {
    parts.push(`stop_reason=${args.stopReason}`)
  }

  if ((args.blockTypes?.length ?? 0) > 0) {
    parts.push(`blocks=${args.blockTypes!.join(',')}`)
  }

  if ((args.ignoredBlockTypes?.length ?? 0) > 0) {
    parts.push(`ignored=${args.ignoredBlockTypes!.join(',')}`)
  }

  return parts.length > 0 ? ` 诊断信息: ${parts.join('; ')}。` : ''
}

// ========== 空响应消息 ==========

export function buildEmptyResponseMessage(args: {
  sawToolResult: boolean
  toolErrorCount: number
  diagnostics?: {
    stopReason?: string
    blockTypes?: string[]
    ignoredBlockTypes?: string[]
  }
}): string {
  const diagnosticsSuffix = formatDiagnostics(args.diagnostics ?? {})

  if (args.sawToolResult) {
    if (args.toolErrorCount > 0) {
      return `工具执行后模型返回空响应，已停止当前回合。最近有 ${args.toolErrorCount} 个工具报错；请重试、调整命令，或让模型改用其他方案。${diagnosticsSuffix}`
    }
    return `工具执行后模型返回空响应，已停止当前回合。请重试，或要求模型继续完成剩余步骤。${diagnosticsSuffix}`
  }

  return `模型返回空响应，已停止当前回合。请重试，或要求模型继续。${diagnosticsSuffix}`
}
