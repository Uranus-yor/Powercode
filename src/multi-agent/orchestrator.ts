import type { ModelAdapter } from '../core/types.js'
import type { ToolRegistry } from '../core/tool-registry.js'
import type { PermissionManager } from '../permissions.js'
import type {
  TaskPlan,
  SubTask,
  AgentResult,
  AgentEvent,
  AgentStatus,
} from './types.js'
import { Worker } from './worker.js'

export type OrchestratorConfig = {
  cwd: string
  model: ModelAdapter
  tools: ToolRegistry
  permissions?: PermissionManager
  maxAgents?: number
  maxSteps?: number
  timeoutMs?: number
  modelName?: string
  systemPrompt?: string
}

export class Orchestrator {
  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig) {
    this.config = config
  }

  async execute(
    plan: TaskPlan,
    onEvent?: (event: AgentEvent) => void,
    onBoardUpdate?: (agents: AgentStatus[]) => void,
  ): Promise<AgentResult[]> {
    if (plan.strategy === 'parallel') {
      return this.executeParallel(plan.tasks, onEvent, onBoardUpdate)
    }
    return this.executeSequential(plan.tasks, onEvent, onBoardUpdate)
  }

  private async executeParallel(
    tasks: SubTask[],
    onEvent?: (event: AgentEvent) => void,
    onBoardUpdate?: (agents: AgentStatus[]) => void,
  ): Promise<AgentResult[]> {
    const agents = this.initAgentStatuses(tasks)
    onBoardUpdate?.(agents)

    const results = await Promise.all(
      tasks.map(task => this.runTask(task, onEvent, onBoardUpdate, agents)),
    )

    return results
  }

  private async executeSequential(
    tasks: SubTask[],
    onEvent?: (event: AgentEvent) => void,
    onBoardUpdate?: (agents: AgentStatus[]) => void,
  ): Promise<AgentResult[]> {
    const agents = this.initAgentStatuses(tasks)
    onBoardUpdate?.(agents)

    const results: AgentResult[] = []
    const completedIds = new Set<string>()
    const outputById = new Map<string, string>()

    for (const task of tasks) {
      const depsMet = task.depends_on.every(d => completedIds.has(d))
      if (!depsMet) {
        const skipped: AgentResult = {
          agentId: task.id,
          success: false,
          output: '',
          toolCalls: 0,
          duration: 0,
          error: `Dependencies not met: ${task.depends_on.filter(d => !completedIds.has(d)).join(', ')}`,
        }
        results.push(skipped)
        this.updateAgentStatus(agents, task.id, 'error', onBoardUpdate)
        continue
      }

      // 把依赖任务的结果注入到任务描述中
      let enrichedDescription = task.description
      if (task.depends_on.length > 0) {
        const depResults = task.depends_on
          .map(id => outputById.get(id))
          .filter(Boolean)
        if (depResults.length > 0) {
          enrichedDescription = `前置任务结果:\n${depResults.join('\n---\n')}\n\n当前任务:\n${task.description}`
        }
      }

      this.updateAgentStatus(agents, task.id, 'running', onBoardUpdate)
      const enrichedTask = { ...task, description: enrichedDescription }
      const result = await this.runTask(enrichedTask, onEvent, onBoardUpdate, agents)
      results.push(result)
      completedIds.add(task.id)
      outputById.set(task.id, result.output)
    }

    return results
  }

  private async runTask(
    task: SubTask,
    onEvent?: (event: AgentEvent) => void,
    onBoardUpdate?: (agents: AgentStatus[]) => void,
    agents: AgentStatus[] = [],
  ): Promise<AgentResult> {
    this.updateAgentStatus(agents, task.id, 'running', onBoardUpdate)

    // 使用精简的 system prompt，不继承主 agent 的完整上下文
    const systemPrompt = `你是一个代码助手。${task.role ? `\n你的角色: ${task.role}` : ''}
任务ID: ${task.id}
任务描述: ${task.description}

规则：
- 专注于完成你的任务，不要执行其他任务
- 用可用的工具完成任务
- 完成后输出结果摘要
- 不要输出与任务无关的内容`

    const worker = new Worker({
      id: task.id,
      label: task.id,
      cwd: this.config.cwd,
      model: this.config.model,
      tools: this.config.tools,
      permissions: this.config.permissions,
      maxSteps: this.config.maxSteps ?? 10,
      timeoutMs: this.config.timeoutMs ?? 60_000,
      modelName: this.config.modelName,
      systemPrompt: `${systemPrompt}\n\n你是子 Agent。${task.role ? `\n你的角色: ${task.role}` : ''}\n任务ID: ${task.id}\n任务描述: ${task.description}\n请专注于完成你的任务，不要执行其他任务。`,
    })

    const result = await worker.run(task, onEvent)

    this.updateAgentStatus(
      agents,
      task.id,
      result.success ? 'done' : 'error',
      onBoardUpdate,
      result.output.slice(0, 100),
    )

    return result
  }

  private initAgentStatuses(tasks: SubTask[]): AgentStatus[] {
    return tasks.map(task => ({
      id: task.id,
      label: task.id,
      task: task.description,
      status: task.depends_on.length > 0 ? 'waiting' as const : 'pending' as const,
    }))
  }

  private updateAgentStatus(
    agents: AgentStatus[],
    agentId: string,
    status: AgentStatus['status'],
    onBoardUpdate?: (agents: AgentStatus[]) => void,
    resultSummary?: string,
  ): void {
    const agent = agents.find(a => a.id === agentId)
    if (agent) {
      agent.status = status
      if (resultSummary !== undefined) {
        agent.result_summary = resultSummary
      }
    }
    onBoardUpdate?.([...agents])
  }

  summarize(results: AgentResult[]): string {
    if (results.length === 0) return '没有执行任何任务。'

    const lines: string[] = []
    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    lines.push(`任务完成 ${successCount}/${results.length}`)

    for (const result of results) {
      lines.push('')
      if (result.success) {
        lines.push(`✓ ${result.agentId}:`)
        // 输出结果，每行缩进
        const outputLines = result.output.split('\n').filter(l => l.trim())
        for (const line of outputLines.slice(0, 5)) {
          lines.push(`  ${line}`)
        }
        if (outputLines.length > 5) {
          lines.push(`  ... (共 ${outputLines.length} 行)`)
        }
      } else {
        lines.push(`✗ ${result.agentId}: ${result.error ?? '未知错误'}`)
      }
    }

    if (failCount > 0) {
      lines.push('')
      lines.push(`${failCount} 个任务失败`)
    }

    return lines.join('\n')
  }
}
