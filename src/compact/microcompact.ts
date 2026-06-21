import type { ChatMessage } from '../core/types.js'
import { COMPACTABLE_TOOLS } from '../utils/context.js'
import { computeContextStats, CLEAR_MARKER } from '../utils/token-estimator.js'
import { THRESHOLDS, RETENTION } from './constants.js'

/**
 * 微压缩 - 清理旧的工具结果
 * 当上下文利用率达到阈值时，清理较旧的工具结果内容
 */
export function microcompact(
  messages: ChatMessage[],
  model: string,
): ChatMessage[] {
  const stats = computeContextStats(messages, model)
  if (stats.utilization < THRESHOLDS.MICROCOMPACT_UTILIZATION) {
    return messages
  }

  const toolResultIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'tool_result' && COMPACTABLE_TOOLS.has(msg.toolName)) {
      toolResultIndices.push(i)
    }
  }

  if (toolResultIndices.length <= RETENTION.KEEP_RECENT_TOOL_RESULTS) {
    return messages
  }

  const keepFrom = toolResultIndices.length - RETENTION.KEEP_RECENT_TOOL_RESULTS
  const indicesToClear = new Set(toolResultIndices.slice(0, keepFrom))

  let changed = false
  const result: ChatMessage[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (indicesToClear.has(i) && msg.role === 'tool_result') {
      if (msg.content !== CLEAR_MARKER) {
        changed = true
        result.push({
          ...msg,
          content: CLEAR_MARKER,
        })
      } else {
        result.push(msg)
      }
    } else {
      result.push(msg)
    }
  }

  return changed ? result : messages
}
