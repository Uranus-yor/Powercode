import { z } from 'zod'
import { ToolRegistry } from '../core/tool-registry.js'
import type { ToolDefinition, ToolContext } from '../core/tool-registry.js'
import type { ModelAdapter, ChatMessage, ModelResponse } from '../core/types.js'
import type { RuntimeConfig } from '../config.js'
import { decomposeTask } from '../multi-agent/router.js'
import { Orchestrator } from '../multi-agent/orchestrator.js'
import { AgentBoardManager } from '../multi-agent/agent-board.js'
import type { AgentEvent, AgentStatus } from '../multi-agent/types.js'

/**
 * 纯文本 ModelAdapter — 不携带工具列表，让 LLM 只返回文本。
 * 用于任务拆分阶段，避免模型返回 tool_calls 导致 content 为空。
 */
function createTextOnlyModel(getRuntimeConfig: () => Promise<RuntimeConfig>): ModelAdapter {
  return {
    async next(messages: ChatMessage[]): Promise<ModelResponse> {
      const runtime = await getRuntimeConfig()
      const url = `${runtime.baseUrl.replace(/\/$/, '')}/v1/messages`

      const system = messages
        .filter(m => m.role === 'system')
        .map(m => ('content' in m ? m.content : ''))
        .join('\n\n')

      const apiMessages = messages
        .filter(m => m.role !== 'system' && 'content' in m)
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: [{ type: 'text' as const, text: String((m as { content: string }).content) }],
        }))

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      }
      if (runtime.authToken) {
        headers.Authorization = `Bearer ${runtime.authToken}`
      } else if (runtime.apiKey) {
        headers['x-api-key'] = runtime.apiKey
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: runtime.model,
          system,
          messages: apiMessages,
          max_tokens: 4096,
          // 不传 tools — 让模型只返回文本
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`)
      }

      const data = await response.json() as {
        content?: Array<{ type: string; text?: string }>
      }

      const textParts = (data.content ?? [])
        .filter(b => b.type === 'text' && typeof b.text === 'string')
        .map(b => b.text as string)

      return {
        type: 'assistant',
        content: textParts.join('\n').trim(),
      }
    },
  }
}

type OrchestrateTasksConfig = {
  model: ModelAdapter
  tools: ToolRegistry
  getRuntimeConfig?: () => Promise<RuntimeConfig>
  modelName?: string
  systemPrompt?: string
  maxSteps?: number
  timeoutMs?: number
  boardManager?: AgentBoardManager
  onBoardUpdate?: (agents: AgentStatus[]) => void
}

export function createOrchestrateTasksTool(
  config: OrchestrateTasksConfig,
): ToolDefinition<{ task: string }> {
  // 用于任务拆分的模型：不携带工具，只返回文本
  const decomposeModel = config.getRuntimeConfig
    ? createTextOnlyModel(config.getRuntimeConfig)
    : config.model

  return {
    name: 'orchestrate_tasks',
    description:
      '将复杂任务拆分成多个子任务，分配给多个子 agent 并行或串行执行。' +
      '仅适用于以下场景：' +
      '1. 需要同时审查/修改 3 个以上文件' +
      '2. 包含 2 个以上完全独立的子任务（如"审查代码+跑测试"）' +
      '3. 任务有明显的阶段性依赖（如"先分析架构，再重构"）' +
      '不适用于：简单查询、单文件操作、只需要一次工具调用的任务。' +
      '输入是高层任务描述，工具内部会自动拆分并执行。',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: '要执行的复杂任务描述，例如"审查 src/ 下所有模块的安全性，顺便跑一下测试"',
        },
      },
      required: ['task'],
    },
    schema: z.object({
      task: z.string().min(1),
    }),
    async run(input, context: ToolContext) {
      const boardManager = config.boardManager ?? new AgentBoardManager()
      boardManager.reset()

      // Step 1: Decompose task using text-only model
      const { plan, error: decomposeError } = await decomposeTask(
        input.task,
        decomposeModel,
      )

      if (!plan || decomposeError) {
        return {
          ok: false,
          output: `任务拆分失败: ${decomposeError ?? '未知错误'}`,
        }
      }

      // Step 2: Initialize board
      for (const task of plan.tasks) {
        boardManager.addAgent(task.id, task.role ?? task.id, task.description)
      }
      config.onBoardUpdate?.(boardManager.getAgents())

      // Step 3: Execute via Orchestrator
      const orchestrator = new Orchestrator({
        cwd: context.cwd,
        model: config.model,
        tools: config.tools,
        permissions: context.permissions,
        maxSteps: config.maxSteps ?? 10,
        timeoutMs: config.timeoutMs ?? 60_000,
        modelName: config.modelName,
        systemPrompt: config.systemPrompt,
      })
      const results = await orchestrator.execute(
        plan,
        (event: AgentEvent) => {
          if (event.type === 'started') {
            boardManager.updateAgent(event.agentId, { status: 'running' })
          } else if (event.type === 'completed') {
            boardManager.updateAgent(event.agentId, {
              status: 'done',
              result_summary: event.result.output.slice(0, 100),
            })
          } else if (event.type === 'error') {
            boardManager.updateAgent(event.agentId, { status: 'error' })
          }
          config.onBoardUpdate?.(boardManager.getAgents())
        },
        (agents: AgentStatus[]) => {
          config.onBoardUpdate?.(agents)
        },
      )

      // Step 4: Build summary
      const summary = orchestrator.summarize(results)

      return {
        ok: true,
        output: summary,
      }
    },
  }
}
