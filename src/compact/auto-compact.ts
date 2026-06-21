import type { ChatMessage, CompressionResult } from '../core/types.js'
import type { ModelAdapter } from '../core/types.js'
import { computeContextStats } from '../utils/token-estimator.js'
import { getModelContextWindow } from '../utils/model-context.js'
import { compactConversation } from './compact.js'
import { THRESHOLDS, LIMITS } from './constants.js'

/** 自动压缩状态 */
type AutoCompactState = {
  consecutiveFailures: number
  disabled: boolean
}

/** 全局自动压缩状态 */
const state: AutoCompactState = {
  consecutiveFailures: 0,
  disabled: false,
}

/**
 * 调试日志输出
 * 仅在 POWER_CODE_DEBUG_AUTOCOMPACT=1 时输出
 */
function debugAutoCompact(message: string): void {
  if (process.env.POWER_CODE_DEBUG_AUTOCOMPACT === '1') {
    console.error(`[auto-compact] ${message}`)
  }
}

/**
 * 重置自动压缩状态
 * 通常在手动压缩成功后调用
 */
export function resetAutoCompactState(): void {
  state.consecutiveFailures = 0
  state.disabled = false
}

/**
 * 获取当前自动压缩状态（只读）
 */
export function getAutoCompactState(): Readonly<AutoCompactState> {
  return { ...state }
}

/**
 * 判断是否应该执行自动压缩
 * 基于上下文利用率阈值判断
 */
export function shouldAutoCompact(messages: ChatMessage[], model: string): boolean {
  const stats = computeContextStats(messages, model)
  const shouldCompact = stats.utilization >= THRESHOLDS.AUTOCOMPACT_UTILIZATION
  debugAutoCompact(
    `source=${stats.accounting.source} total=${stats.accounting.totalTokens} ` +
      `provider=${stats.accounting.providerUsageTokens} estimate=${stats.accounting.estimatedTokens} ` +
      `utilization=${stats.utilization.toFixed(3)} threshold=${THRESHOLDS.AUTOCOMPACT_UTILIZATION} ` +
      `should=${shouldCompact}`,
  )
  return shouldCompact
}

/**
 * 执行自动压缩
 * 当上下文利用率超过阈值时自动压缩对话
 */
export async function autoCompact(
  messages: ChatMessage[],
  model: string,
  modelAdapter: ModelAdapter,
): Promise<CompressionResult | null> {
  if (state.disabled) {
    return null
  }

  const window = getModelContextWindow(model)
  if (window.effectiveInput < LIMITS.MIN_EFFECTIVE_INPUT_FOR_AUTOCOMPACT) {
    return null
  }

  if (!shouldAutoCompact(messages, model)) {
    return null
  }

  try {
    const result = await compactConversation(messages, modelAdapter)
    if (result) {
      state.consecutiveFailures = 0
      return result
    }

    state.consecutiveFailures++
    if (state.consecutiveFailures >= LIMITS.MAX_AUTOCOMPACT_FAILURES) {
      state.disabled = true
    }
    return null
  } catch {
    state.consecutiveFailures++
    if (state.consecutiveFailures >= LIMITS.MAX_AUTOCOMPACT_FAILURES) {
      state.disabled = true
    }
    return null
  }
}
