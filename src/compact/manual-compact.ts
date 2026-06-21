import type { ChatMessage, CompressionResult } from '../core/types.js'
import type { ModelAdapter } from '../core/types.js'
import { compactConversation } from './compact.js'
import { resetAutoCompactState } from './auto-compact.js'

/**
 * 手动压缩对话
 * 用户主动触发的压缩操作
 */
export async function manualCompact(
  messages: ChatMessage[],
  modelAdapter: ModelAdapter,
): Promise<CompressionResult | null> {
  const result = await compactConversation(messages, modelAdapter)
  if (result) {
    resetAutoCompactState()
  }
  return result
}
