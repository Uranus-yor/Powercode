import type { ThinkingBlock } from './types.js'

// ========== 进度消息处理 ==========

export function handleProgressMessage(
  content: string,
  callbacks: {
    onProgressMessage?: (content: string) => void
    appendThinkingBlocks?: (blocks: ThinkingBlock[]) => void
  },
): void {
  callbacks.onProgressMessage?.(content)
}

// ========== 进度继续提示 ==========

export function buildProgressContinuationPrompt(sawToolResult: boolean): string {
  if (sawToolResult) {
    return 'Continue from your progress update. You have already used tools in this turn, so treat plain status text as progress, not a final answer. Respond with the next concrete tool call, code change, or an explicit <final> answer only if the task is truly complete.'
  }
  return 'Continue immediately from your <progress> update with concrete tool calls, code changes, or an explicit <final> answer only if the task is complete.'
}

// ========== 进度判断 ==========

export function isProgressUpdate(args: {
  kind?: 'final' | 'progress'
  content: string
  sawToolResultThisTurn: boolean
}): boolean {
  if (args.kind === 'progress') {
    return true
  }

  if (args.kind === 'final') {
    return false
  }

  if (!args.sawToolResultThisTurn) {
    return false
  }

  return false
}
