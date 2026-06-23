import { runAgentLoop } from '../core/agent-loop.js'
import type { ChatMessage, ModelAdapter } from '../core/types.js'
import { ToolRegistry } from '../core/tool-registry.js'
import type { PermissionManager } from '../permissions.js'
import type { SubTask, AgentResult, AgentEvent } from './types.js'

export type WorkerConfig = {
  id: string
  label: string
  cwd: string
  model: ModelAdapter
  tools: ToolRegistry
  permissions?: PermissionManager
  maxSteps?: number
  timeoutMs?: number
  modelName?: string
  systemPrompt?: string
}

export class Worker {
  readonly id: string
  readonly label: string
  private config: WorkerConfig

  constructor(config: WorkerConfig) {
    this.id = config.id
    this.label = config.label
    this.config = config
  }

  private getToolsForTask(task: SubTask): ToolRegistry {
    // 如果没有指定工具，返回空的 ToolRegistry（子 agent 不需要工具）
    if (!task.tools || task.tools.length === 0) {
      return new ToolRegistry([])
    }

    const allTools = this.config.tools.getAllTools()

    // 精确匹配
    let filteredTools = allTools.filter(tool => task.tools.includes(tool.name))

    // 精确匹配失败时，尝试模糊匹配（LLM 可能写错工具名）
    if (filteredTools.length === 0) {
      filteredTools = allTools.filter(tool =>
        task.tools.some(t => tool.name.includes(t) || t.includes(tool.name)),
      )
    }

    // 如果仍然没有匹配，返回全部工具（让子 agent 自己选择）
    if (filteredTools.length === 0) {
      return new ToolRegistry(allTools)
    }

    return new ToolRegistry(filteredTools)
  }

  async run(
    task: SubTask,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<AgentResult> {
    const startTime = Date.now()
    let toolCalls = 0

    onEvent?.({
      type: 'started',
      agentId: this.id,
      task: task.description,
      timestamp: startTime,
    })

    try {
      const messages: ChatMessage[] = []

      if (this.config.systemPrompt) {
        messages.push({
          role: 'system',
          content: this.config.systemPrompt,
        })
      }

      messages.push({
        role: 'user',
        content: task.description,
      })

      const tools = this.getToolsForTask(task)

      // 超时信号：超时后设为 true，runAgentLoop 会在下一步注入总结提示
      const shouldSummarize = { value: false }
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null
      if (this.config.timeoutMs) {
        timeoutTimer = setTimeout(() => {
          shouldSummarize.value = true
        }, this.config.timeoutMs)
      }

      const result = await runAgentLoop({
        model: this.config.model,
        tools,
        messages,
        cwd: this.config.cwd,
        permissions: this.config.permissions,
        maxSteps: this.config.maxSteps,
        modelName: this.config.modelName,
        shouldSummarize,
        onToolStart: (toolName) => {
          toolCalls++
          onEvent?.({
            type: 'progress',
            agentId: this.id,
            toolName,
            timestamp: Date.now(),
          })
        },
        onToolResult: () => {},
        onAssistantMessage: (content) => {
          onEvent?.({
            type: 'progress',
            agentId: this.id,
            message: content.slice(0, 200),
            timestamp: Date.now(),
          })
        },
      })

      if (timeoutTimer) clearTimeout(timeoutTimer)

      const duration = Date.now() - startTime
      const lastAssistant = [...result]
        .reverse()
        .find(m => m.role === 'assistant')

      const output = lastAssistant && 'content' in lastAssistant
        ? lastAssistant.content
        : ''

      const agentResult: AgentResult = {
        agentId: this.id,
        success: true,
        output,
        toolCalls,
        duration,
      }

      onEvent?.({
        type: 'completed',
        agentId: this.id,
        result: agentResult,
        timestamp: Date.now(),
      })

      return agentResult
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      const agentResult: AgentResult = {
        agentId: this.id,
        success: false,
        output: '',
        toolCalls,
        duration,
        error: errorMessage,
      }

      onEvent?.({
        type: 'error',
        agentId: this.id,
        error: errorMessage,
        timestamp: Date.now(),
      })

      return agentResult
    }
  }
}
