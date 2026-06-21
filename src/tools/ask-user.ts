import { z } from 'zod'
import type { ToolDefinition } from '../core/tool-registry.js'

type Input = {
  question: string
}

/**
 * 向用户提问并等待回复的工具
 * 用于需要用户澄清或确认的场景
 */
export const askUserTool: ToolDefinition<Input> = {
  name: 'ask_user',
  description:
    'Ask the user a clarifying question and stop the current turn until the user replies.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string' },
    },
    required: ['question'],
  },
  schema: z.object({
    question: z.string().min(1),
  }),
  async run(input) {
    const question = input.question.trim()
    return {
      ok: true,
      output: question,
      awaitUser: true,
    }
  },
}
