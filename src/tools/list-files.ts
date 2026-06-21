import { readdir } from 'node:fs/promises'
import { z } from 'zod'
import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveToolPath } from '../workspace.js'

type Input = {
  path?: string
}

/**
 * 列出目录中的文件和文件夹
 * 支持相对路径，默认为工作区根目录
 */
export const listFilesTool: ToolDefinition<Input> = {
  name: 'list_files',
  description: 'List files in a directory relative to the workspace root.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
    },
  },
  schema: z.object({
    path: z.string().optional(),
  }),
  async run(input, context) {
    const target = await resolveToolPath(context, input.path ?? '.', 'list')
    const entries = await readdir(target, { withFileTypes: true })
    const lines = entries
      .slice(0, 200)
      .map(entry => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)

    return {
      ok: true,
      output: lines.join('\n') || '(empty)',
    }
  },
}
