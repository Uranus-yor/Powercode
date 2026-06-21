/**
 * 智能代码搜索工具定义
 */

import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../core/tool-registry.js'
import { buildIndex, updateIndex, getIndexStats } from './indexer.js'
import { createSearchEngine } from './search.js'
import { loadIndex, indexExists, deleteIndex } from './storage.js'
import { DEFAULT_INDEX_CONFIG } from './types.js'

/** code_index_build 工具 */
const codeIndexBuildTool: ToolDefinition<{
  path?: string
  force?: boolean
}> = {
  name: 'code_index_build',
  description: '构建或更新智能代码搜索索引。索引用于快速搜索代码符号和语义匹配。',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '项目路径，默认为当前目录' },
      force: { type: 'boolean', description: '强制重新构建索引' },
    },
  },
  schema: z.object({
    path: z.string().optional(),
    force: z.boolean().optional(),
  }),
  async run(input, context) {
    const projectRoot = input.path || context.cwd

    try {
      let index
      if (input.force || !indexExists(projectRoot)) {
        index = await buildIndex(projectRoot, DEFAULT_INDEX_CONFIG)
      } else {
        index = await updateIndex(projectRoot, DEFAULT_INDEX_CONFIG)
      }

      const stats = getIndexStats(index)

      return {
        ok: true,
        output: JSON.stringify({
          message: '索引构建完成',
          stats: {
            files: stats.fileCount,
            symbols: stats.symbolCount,
            blocks: stats.blockCount,
            symbolsByKind: stats.symbolsByKind,
          },
        }, null, 2),
      }
    } catch (error) {
      return {
        ok: false,
        output: `索引构建失败: ${error}`,
      }
    }
  },
}

/** code_index_search 工具 */
const codeIndexSearchTool: ToolDefinition<{
  query: string
  limit?: number
}> = {
  name: 'code_index_search',
  description: '使用智能代码搜索查找代码。支持符号名称、代码片段、自然语言描述。',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询' },
      limit: { type: 'number', description: '返回结果数量，默认 10' },
    },
    required: ['query'],
  },
  schema: z.object({
    query: z.string().min(1),
    limit: z.number().optional(),
  }),
  async run(input, context) {
    try {
      // 加载索引
      const index = loadIndex(context.cwd)
      if (!index) {
        return {
          ok: false,
          output: '索引不存在，请先运行 code_index_build 构建索引',
        }
      }

      // 创建搜索引擎
      const engine = createSearchEngine(index)

      // 执行搜索
      const results = await engine.search(input.query, {
        limit: input.limit || 10,
      })

      // 格式化结果
      const formattedResults = results.map(result => ({
        file: result.file,
        score: Math.round(result.score * 100) / 100,
        reason: result.reason,
        blocks: result.blocks.map(block => ({
          startLine: block.startLine,
          endLine: block.endLine,
          content: block.content.substring(0, 500),
          symbols: block.symbols.map(s => s.name),
        })),
      }))

      return {
        ok: true,
        output: JSON.stringify({
          query: input.query,
          resultCount: formattedResults.length,
          results: formattedResults,
        }, null, 2),
      }
    } catch (error) {
      return {
        ok: false,
        output: `搜索失败: ${error}`,
      }
    }
  },
}

/** code_index_find_definition 工具 */
const codeIndexFindDefinitionTool: ToolDefinition<{
  symbol: string
}> = {
  name: 'code_index_find_definition',
  description: '查找符号的定义位置。',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: '符号名称' },
    },
    required: ['symbol'],
  },
  schema: z.object({
    symbol: z.string().min(1),
  }),
  async run(input, context) {
    try {
      const index = loadIndex(context.cwd)
      if (!index) {
        return {
          ok: false,
          output: '索引不存在，请先运行 code_index_build 构建索引',
        }
      }

      const symbols = index.symbols.get(input.symbol)
      if (!symbols || symbols.length === 0) {
        return {
          ok: false,
          output: `未找到符号: ${input.symbol}`,
        }
      }

      // 过滤出定义（非引用）
      const definitions = symbols.filter(
        s =>
          s.kind === 'function' ||
          s.kind === 'class' ||
          s.kind === 'interface' ||
          s.kind === 'type' ||
          s.kind === 'enum'
      )

      return {
        ok: true,
        output: JSON.stringify({
          symbol: input.symbol,
          definitions: (definitions.length > 0 ? definitions : symbols).map(s => ({
            name: s.name,
            kind: s.kind,
            file: s.file,
            startLine: s.startLine,
            endLine: s.endLine,
            content: s.content.substring(0, 300),
            parentName: s.parentName,
          })),
        }, null, 2),
      }
    } catch (error) {
      return {
        ok: false,
        output: `查找定义失败: ${error}`,
      }
    }
  },
}

/** code_index_find_references 工具 */
const codeIndexFindReferencesTool: ToolDefinition<{
  symbol: string
}> = {
  name: 'code_index_find_references',
  description: '查找符号的所有引用位置。',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: '符号名称' },
    },
    required: ['symbol'],
  },
  schema: z.object({
    symbol: z.string().min(1),
  }),
  async run(input, context) {
    try {
      const index = loadIndex(context.cwd)
      if (!index) {
        return {
          ok: false,
          output: '索引不存在，请先运行 code_index_build 构建索引',
        }
      }

      const references = index.references.get(input.symbol)
      if (!references || references.length === 0) {
        return {
          ok: true,
          output: JSON.stringify({
            symbol: input.symbol,
            references: [],
            message: '未找到引用（可能需要更新索引）',
          }, null, 2),
        }
      }

      return {
        ok: true,
        output: JSON.stringify({
          symbol: input.symbol,
          references: references.map(r => ({
            file: r.file,
            line: r.line,
            context: r.context,
          })),
        }, null, 2),
      }
    } catch (error) {
      return {
        ok: false,
        output: `查找引用失败: ${error}`,
      }
    }
  },
}

/** code_index_delete 工具 */
const codeIndexDeleteTool: ToolDefinition<{
  path?: string
}> = {
  name: 'code_index_delete',
  description: '删除代码索引。',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '项目路径，默认为当前目录' },
    },
  },
  schema: z.object({
    path: z.string().optional(),
  }),
  async run(input, context) {
    const projectRoot = input.path || context.cwd

    try {
      if (!indexExists(projectRoot)) {
        return {
          ok: false,
          output: '索引不存在',
        }
      }

      deleteIndex(projectRoot)

      return {
        ok: true,
        output: '索引已删除',
      }
    } catch (error) {
      return {
        ok: false,
        output: `删除索引失败: ${error}`,
      }
    }
  },
}

/** 导出所有工具 */
export const codeIndexTools: ToolDefinition[] = [
  codeIndexBuildTool,
  codeIndexSearchTool,
  codeIndexFindDefinitionTool,
  codeIndexFindReferencesTool,
  codeIndexDeleteTool,
]
