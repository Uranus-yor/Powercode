import { z } from 'zod'
import type { PermissionManager } from '../permissions.js'
import type { SkillSummary } from '../skills.js'
import type { McpServerSummary } from '../mcp.js'
import type { ToolResult } from './types.js'

// Re-export for backward compatibility
export type { ToolResult } from './types.js'

// ========== 工具上下文 ==========

export type ToolContext = {
  cwd: string
  permissions?: PermissionManager
}

// ========== 工具定义 ==========

export type ToolDefinition<TInput = unknown> = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  schema: z.ZodType<TInput>
  run(input: TInput, context: ToolContext): Promise<ToolResult>
}

// ========== 工具元数据 ==========

export type ToolMetadata = {
  skills?: SkillSummary[]
  mcpServers?: McpServerSummary[]
}

// ========== 工具注册表 ==========

export class ToolRegistry {
  private readonly tools: Map<string, ToolDefinition>
  private metadata: ToolMetadata
  private readonly disposers: Array<() => Promise<void>>

  constructor(
    tools: ToolDefinition[],
    metadata: ToolMetadata = {},
    disposer?: () => Promise<void>,
  ) {
    this.tools = new Map(tools.map(t => [t.name, t]))
    this.metadata = metadata
    this.disposers = disposer ? [disposer] : []
  }

  // 查询
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAllTools(): ToolDefinition[] {
    return [...this.tools.values()]
  }

  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  // 元数据
  getSkills(): SkillSummary[] {
    return this.metadata.skills ?? []
  }

  getMcpServers(): McpServerSummary[] {
    return this.metadata.mcpServers ?? []
  }

  setMcpServers(servers: McpServerSummary[]): void {
    this.metadata = {
      ...this.metadata,
      mcpServers: [...servers],
    }
  }

  // 注册
  addTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, tool)
      }
    }
  }

  addDisposer(disposer: () => Promise<void>): void {
    this.disposers.push(disposer)
  }

  // 执行
  async execute(
    toolName: string,
    input: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.getTool(toolName)
    if (!tool) {
      return {
        ok: false,
        output: `Unknown tool: ${toolName}`,
      }
    }

    const parsed = tool.schema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        output: parsed.error.message,
      }
    }

    try {
      return await tool.run(parsed.data, context)
    } catch (error) {
      return {
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 清理
  async dispose(): Promise<void> {
    await Promise.all(this.disposers.map(disposer => disposer()))
  }
}
