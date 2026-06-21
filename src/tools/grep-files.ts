import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveToolPath } from '../workspace.js'

const execFileAsync = promisify(execFile)

type Input = {
  pattern: string
  path?: string
}

/** 使用 Node.js 搜索文件内容（最终回退方案） */
function grepWithNode(cwd: string, pattern: string, searchPath: string): string {
  const results: string[] = []
  const regex = new RegExp(pattern, 'gi')
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          // 跳过常见忽略目录
          if (!['node_modules', '.git', 'dist', 'build', '.powercode'].includes(entry.name)) {
            walk(fullPath)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          if (extensions.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8')
              const lines = content.split('\n')
              const relativePath = path.relative(cwd, fullPath)
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push(`${relativePath}:${i + 1}:${lines[i].trim()}`)
                }
              }
              regex.lastIndex = 0 // 重置正则
            } catch {
              // 跳过无法读取的文件
            }
          }
        }
      }
    } catch {
      // 跳过无法访问的目录
    }
  }

  walk(searchPath)
  return results.join('\n')
}

/**
 * 搜索文件内容
 * 优先使用 ripgrep，不存在则回退到 Node.js 实现
 */
export const grepFilesTool: ToolDefinition<Input> = {
  name: 'grep_files',
  description: 'Search for text in files. Uses ripgrep if available, otherwise falls back to built-in search.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      path: { type: 'string' },
    },
    required: ['pattern'],
  },
  schema: z.object({
    pattern: z.string().min(1),
    path: z.string().optional(),
  }),
  async run(input, context) {
    const pathArg = input.path
      ? await resolveToolPath(context, input.path, 'search')
      : context.cwd

    // 优先使用 ripgrep
    try {
      const rgArgs = ['-n', '--no-heading', input.pattern, pathArg]
      const result = await execFileAsync('rg', rgArgs, {
        cwd: context.cwd,
        maxBuffer: 1024 * 1024,
      })
      return {
        ok: true,
        output: (result.stdout || result.stderr || '').trim() || '(no matches)',
      }
    } catch {
      // rg 不存在，使用 Node.js 实现
      const output = grepWithNode(context.cwd, input.pattern, pathArg)
      return {
        ok: true,
        output: output || '(no matches)',
      }
    }
  },
}
