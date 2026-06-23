import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decomposeTask } from '../../src/multi-agent/router.js'
import { Orchestrator } from '../../src/multi-agent/orchestrator.js'
import { AgentBoardManager } from '../../src/multi-agent/agent-board.js'
import { createOrchestrateTasksTool } from '../../src/tools/orchestrate-tasks.js'
import { ToolRegistry } from '../../src/core/tool-registry.js'
import type { ModelAdapter, ChatMessage, ModelResponse } from '../../src/core/types.js'
import type { TaskPlan, AgentEvent, AgentStatus } from '../../src/multi-agent/types.js'

function createMockModel(response: string = 'Task completed'): ModelAdapter {
  return {
    async next(_messages: ChatMessage[]): Promise<ModelResponse> {
      return { type: 'assistant', content: response }
    },
  }
}

function createDecomposeModel(strategy: string, tasks: Array<{ id: string; role?: string; description: string; tools: string[]; depends_on: string[] }>): ModelAdapter {
  return {
    async next(messages: ChatMessage[]): Promise<ModelResponse> {
      const systemMsg = messages.find(m => m.role === 'system')
      if (systemMsg && systemMsg.content.includes('任务编排器')) {
        return {
          type: 'assistant',
          content: JSON.stringify({
            strategy,
            reason: `LLM detected ${strategy} task`,
            tasks,
          }),
        }
      }
      return { type: 'assistant', content: 'Task completed' }
    },
  }
}

describe('Multi-Agent E2E (tool-driven)', () => {
  describe('decomposeTask', () => {
    it('decomposes parallel tasks with roles', async () => {
      const mockModel = createDecomposeModel('parallel', [
        { id: 'reviewer', role: '安全审查员', description: '审查 auth.ts', tools: ['read_file'], depends_on: [] },
        { id: 'tester', role: '测试工程师', description: '运行测试', tools: ['run_command'], depends_on: [] },
      ])
      const { plan, error } = await decomposeTask('审查 src/auth.ts，顺便跑一下测试', mockModel)
      assert.equal(error, null)
      assert.ok(plan)
      assert.equal(plan!.strategy, 'parallel')
      assert.equal(plan!.tasks.length, 2)
      assert.equal(plan!.tasks[0]!.role, '安全审查员')
      assert.equal(plan!.tasks[1]!.role, '测试工程师')
    })

    it('decomposes sequential tasks with roles', async () => {
      const mockModel = createDecomposeModel('sequential', [
        { id: 'analyzer', role: '架构分析师', description: '分析架构', tools: ['read_file'], depends_on: [] },
        { id: 'refactorer', role: '重构专家', description: '重构代码', tools: ['read_file', 'write_file'], depends_on: ['analyzer'] },
      ])
      const { plan, error } = await decomposeTask('重构认证模块，同步修改所有调用方', mockModel)
      assert.equal(error, null)
      assert.ok(plan)
      assert.equal(plan!.strategy, 'sequential')
      assert.equal(plan!.tasks.length, 2)
      assert.equal(plan!.tasks[0]!.role, '架构分析师')
      assert.deepEqual(plan!.tasks[1]!.depends_on, ['analyzer'])
    })

    it('returns error for simple tasks that LLM answers directly', async () => {
      const mockModel = createMockModel('这是一个解释...')
      const { plan, error } = await decomposeTask('TypeScript 怎么定义泛型', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
    })

    it('returns error for empty input', async () => {
      const mockModel = createMockModel('')
      const { plan, error } = await decomposeTask('', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
    })
  })

  describe('orchestrate_tasks tool E2E', () => {
    it('full parallel flow: decompose → execute → summarize', async () => {
      const model = createDecomposeModel('parallel', [
        { id: 'reviewer', role: '安全审查员', description: '审查代码', tools: [], depends_on: [] },
        { id: 'tester', role: '测试工程师', description: '运行测试', tools: [], depends_on: [] },
      ])

      const tool = createOrchestrateTasksTool({ model, tools: new ToolRegistry([]) })
      const result = await tool.run(
        { task: '审查安全性并跑测试' },
        { cwd: '/tmp' },
      )

      assert.equal(result.ok, true)
      assert.ok(result.output.includes('2/2'))
      assert.ok(result.output.includes('reviewer'))
      assert.ok(result.output.includes('tester'))
    })

    it('full sequential flow: decompose → execute → summarize', async () => {
      const model = createDecomposeModel('sequential', [
        { id: 'analyzer', role: '架构分析师', description: '分析架构', tools: [], depends_on: [] },
        { id: 'refactorer', role: '重构专家', description: '重构代码', tools: [], depends_on: ['analyzer'] },
      ])

      const tool = createOrchestrateTasksTool({ model, tools: new ToolRegistry([]) })
      const result = await tool.run(
        { task: '分析架构后重构' },
        { cwd: '/tmp' },
      )

      assert.equal(result.ok, true)
      assert.ok(result.output.includes('2/2'))
    })

    it('handles partial failure', async () => {
      let callCount = 0
      const model: ModelAdapter = {
        async next(messages: ChatMessage[]): Promise<ModelResponse> {
          const systemMsg = messages.find(m => m.role === 'system')
          if (systemMsg && systemMsg.content.includes('任务编排器')) {
            return {
              type: 'assistant',
              content: JSON.stringify({
                strategy: 'parallel',
                reason: 'Test',
                tasks: [
                  { id: 't1', role: '审查员', description: '审查', tools: [], depends_on: [] },
                  { id: 't2', role: '测试员', description: '测试', tools: [], depends_on: [] },
                ],
              }),
            }
          }
          callCount++
          if (callCount === 1) {
            throw new Error('Sub-agent failed')
          }
          return { type: 'assistant', content: 'Done' }
        },
      }

      const tool = createOrchestrateTasksTool({ model, tools: new ToolRegistry([]) })
      const result = await tool.run(
        { task: '审查并测试' },
        { cwd: '/tmp' },
      )

      assert.equal(result.ok, true)
      assert.ok(result.output.includes('1/2'))
      assert.ok(result.output.includes('failed'))
    })

    it('returns error when decomposition fails', async () => {
      const model = createMockModel('Not JSON')
      const tool = createOrchestrateTasksTool({ model, tools: new ToolRegistry([]) })
      const result = await tool.run(
        { task: '审查代码' },
        { cwd: '/tmp' },
      )

      assert.equal(result.ok, false)
      assert.ok(result.output.includes('任务拆分失败'))
    })
  })

  describe('AgentBoardManager integration', () => {
    it('tracks agent lifecycle', () => {
      const manager = new AgentBoardManager()

      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      assert.equal(manager.getAgents().length, 1)
      assert.equal(manager.getAgent('agent-1')!.status, 'pending')

      manager.updateAgent('agent-1', { status: 'running' })
      assert.equal(manager.getAgent('agent-1')!.status, 'running')

      manager.updateAgent('agent-1', { status: 'done', result_summary: 'No issues' })
      assert.equal(manager.getAgent('agent-1')!.status, 'done')
      assert.equal(manager.getAgent('agent-1')!.result_summary, 'No issues')
    })
  })

  describe('Orchestrator direct execution', () => {
    it('executes parallel tasks successfully', async () => {
      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Independent tasks',
        tasks: [
          { id: 'reviewer', description: 'Review auth.ts', tools: [], depends_on: [] },
          { id: 'tester', description: 'Run tests', tools: [], depends_on: [] },
        ],
      }

      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel('Review completed, no issues'),
        tools: new ToolRegistry([]),
      })

      const events: AgentEvent[] = []
      const boardUpdates: AgentStatus[][] = []

      const results = await orch.execute(
        plan,
        (e) => events.push(e),
        (agents) => boardUpdates.push([...agents]),
      )

      assert.equal(results.length, 2)
      assert.equal(results[0]!.success, true)
      assert.equal(results[1]!.success, true)
      assert.ok(events.length >= 4)
      assert.ok(boardUpdates.length > 0)
    })

    it('executes sequential tasks in order', async () => {
      const executionOrder: string[] = []
      const plan: TaskPlan = {
        strategy: 'sequential',
        outputMode: 'collect',
        reason: 'Dependent tasks',
        tasks: [
          { id: 'agent-1', description: 'Refactor auth', tools: [], depends_on: [] },
          { id: 'agent-2', description: 'Update callers', tools: [], depends_on: ['agent-1'] },
        ],
      }

      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const results = await orch.execute(plan, (e) => {
        if (e.type === 'started') executionOrder.push(e.agentId)
      })

      assert.equal(results.length, 2)
      assert.equal(results[0]!.success, true)
      assert.equal(results[1]!.success, true)
      assert.deepEqual(executionOrder, ['agent-1', 'agent-2'])
    })

    it('handles orchestrator errors gracefully', async () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: {
          async next(): Promise<ModelResponse> {
            throw new Error('API rate limited')
          },
        },
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Test',
        tasks: [
          { id: 'agent-1', description: 'Task 1', tools: [], depends_on: [] },
        ],
      }

      const results = await orch.execute(plan)
      assert.equal(results.length, 1)
      assert.equal(results[0]!.success, false)
      assert.ok(results[0]!.error)
    })
  })
})
