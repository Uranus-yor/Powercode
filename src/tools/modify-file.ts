import { z } from 'zod'
import { applyReviewedFileChange } from '../file-review.js'
import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveToolPath } from '../workspace.js'

type Input = {
  path: string
  content: string
}

/**
 * 替换整个文件内容
 * 通过文件审查机制应用更改，用户可选择接受或拒绝
 */
export const modifyFileTool: ToolDefinition<Input> = {
  name: 'modify_file',
  description: 'Replace a file with reviewed content so the user can approve the diff first.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  },
  schema: z.object({
    path: z.string().min(1),
    content: z.string(),
  }),
  async run(input, context) {
    const target = await resolveToolPath(context, input.path, 'write')
    return applyReviewedFileChange(context, input.path, target, input.content)
  },
}
