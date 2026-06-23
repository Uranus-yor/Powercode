import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Orchestrator } from '../../src/multi-agent/orchestrator.js'
import { ToolRegistry } from '../../src/core/tool-registry.js'
import type { ModelAdapter, ChatMessage, ModelResponse } from '../../src/core/types.js'
import type { TaskPlan, AgentEvent, AgentStatus } from '../../src/multi-agent/types.js'

function createMockModel(response: string = 'Done'): ModelAdapter {
  return {
    async next(_messages: ChatMessage[]): Promise<ModelResponse> {
      return { type: 'assistant', content: response }
    },
  }
}

function createCapturingModel(response: string = 'Done'): ModelAdapter & { capturedMessages: ChatMessage[][] } {
  const captured: ChatMessage[][] = []
  return {
    capturedMessages: captured,
    async next(messages: ChatMessage[]): Promise<ModelResponse> {
      captured.push([...messages])
      return { type: 'assistant', content: response }
    },
  }
}

describe('Orchestrator', () => {
  it('creates with config', () => {
    const orch = new Orchestrator({
      cwd: '/tmp',
      model: createMockModel(),
      tools: new ToolRegistry([]),
    })
    assert.ok(orch)
  })

  describe('execute parallel', () => {
    it('runs parallel tasks and returns results', async () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel('Task done'),
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Test',
        tasks: [
          { id: 't1', description: 'Task 1', tools: [], depends_on: [] },
          { id: 't2', description: 'Task 2', tools: [], depends_on: [] },
        ],
      }

      const results = await orch.execute(plan)
      assert.equal(results.length, 2)
      assert.equal(results[0]!.success, true)
      assert.equal(results[1]!.success, true)
    })

    it('emits events during parallel execution', async () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Test',
        tasks: [
          { id: 't1', description: 'Task 1', tools: [], depends_on: [] },
        ],
      }

      const events: AgentEvent[] = []
      await orch.execute(plan, (e) => events.push(e))

      assert.ok(events.length >= 2)
      assert.equal(events[0]!.type, 'started')
      assert.equal(events[events.length - 1]!.type, 'completed')
    })

    it('updates board during parallel execution', async () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Test',
        tasks: [
          { id: 't1', description: 'Task 1', tools: [], depends_on: [] },
          { id: 't2', description: 'Task 2', tools: [], depends_on: [] },
        ],
      }

      const boardSnapshots: AgentStatus[][] = []
      await orch.execute(plan, undefined, (agents) => boardSnapshots.push([...agents]))

      assert.ok(boardSnapshots.length > 0)
      const lastSnapshot = boardSnapshots[boardSnapshots.length - 1]!
      assert.ok(lastSnapshot.every(a => a.status === 'done'))
    })
  })

  describe('execute sequential', () => {
    it('runs tasks in order', async () => {
      const executionOrder: string[] = []
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'sequential',
        outputMode: 'collect',
        reason: 'Test',
        tasks: [
          { id: 't1', description: 'Task 1', tools: [], depends_on: [] },
          { id: 't2', description: 'Task 2', tools: [], depends_on: ['t1'] },
        ],
      }

      const results = await orch.execute(plan, (e) => {
        if (e.type === 'started') executionOrder.push(e.agentId)
      })

      assert.equal(results.length, 2)
      assert.equal(results[0]!.success, true)
      assert.equal(results[1]!.success, true)
      assert.deepEqual(executionOrder, ['t1', 't2'])
    })

    it('skips tasks with unmet dependencies', async () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'sequential',
        outputMode: 'collect',
        reason: 'Test',
        tasks: [
          { id: 't1', description: 'Task 1', tools: [], depends_on: [] },
          { id: 't2', description: 'Task 2', tools: [], depends_on: ['nonexistent'] },
        ],
      }

      const results = await orch.execute(plan)
      assert.equal(results.length, 2)
      assert.equal(results[0]!.success, true)
      assert.equal(results[1]!.success, false)
      assert.match(results[1]!.error!, /dependencies not met/i)
    })
  })

  describe('role injection', () => {
    it('includes role in sub-agent system prompt when present', async () => {
      const mockModel = createCapturingModel('Review done')
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: mockModel,
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Test',
        tasks: [
          { id: 't1', description: '审查 src/auth.ts', tools: [], depends_on: [], role: '安全审查员' },
        ],
      }

      await orch.execute(plan)

      assert.ok(mockModel.capturedMessages.length > 0)
      const systemMsg = mockModel.capturedMessages[0]!.find(m => m.role === 'system')
      assert.ok(systemMsg)
      assert.ok(systemMsg!.content.includes('安全审查员'))
      assert.ok(systemMsg!.content.includes('你的角色'))
    })

    it('does not include role line when role is absent', async () => {
      const mockModel = createCapturingModel('Done')
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: mockModel,
        tools: new ToolRegistry([]),
      })

      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Test',
        tasks: [
          { id: 't1', description: 'Run tests', tools: [], depends_on: [] },
        ],
      }

      await orch.execute(plan)

      assert.ok(mockModel.capturedMessages.length > 0)
      const systemMsg = mockModel.capturedMessages[0]!.find(m => m.role === 'system')
      assert.ok(systemMsg)
      assert.ok(!systemMsg!.content.includes('你的角色'))
    })
  })

  describe('summarize', () => {
    it('summarizes successful results', () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const results: Array<{ agentId: string; success: boolean; output: string; toolCalls: number; duration: number }> = [
        { agentId: 'reviewer', success: true, output: 'No issues found', toolCalls: 2, duration: 1000 },
        { agentId: 'tester', success: true, output: '249 passed', toolCalls: 1, duration: 500 },
      ]
      const summary = orch.summarize(results)

      assert.ok(summary.includes('2/2'))
      assert.ok(summary.includes('reviewer'))
      assert.ok(summary.includes('tester'))
    })

    it('summarizes mixed results', () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const results: Array<{ agentId: string; success: boolean; output: string; toolCalls: number; duration: number; error?: string }> = [
        { agentId: 'worker-1', success: true, output: 'Done', toolCalls: 1, duration: 100 },
        { agentId: 'worker-2', success: false, output: '', toolCalls: 0, duration: 50, error: 'Failed' },
      ]
      const summary = orch.summarize(results)

      assert.ok(summary.includes('1/2'))
      assert.ok(summary.includes('失败'))
    })

    it('handles empty results', () => {
      const orch = new Orchestrator({
        cwd: '/tmp',
        model: createMockModel(),
        tools: new ToolRegistry([]),
      })

      const summary = orch.summarize([])
      assert.ok(summary.includes('没有执行任何任务'))
    })
  })
})
