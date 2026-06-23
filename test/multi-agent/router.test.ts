import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyTask, decomposeTask } from '../../src/multi-agent/router.js'
import type { ModelAdapter, ChatMessage, ModelResponse } from '../../src/core/types.js'

function createMockModel(response: string): ModelAdapter {
  return {
    async next(_messages: ChatMessage[]): Promise<ModelResponse> {
      return { type: 'assistant', content: response }
    },
  }
}

describe('classifyTask', () => {
  describe('simple task - LLM answers directly', () => {
    it('returns answer when LLM returns plain text', async () => {
      const mockModel = createMockModel('这是一个 TypeScript 泛型的解释...')
      const plan = await classifyTask('TypeScript 怎么定义泛型', 0, mockModel)
      assert.equal(plan.strategy, 'single')
      assert.ok(plan.answer)
      assert.ok(plan.answer.includes('TypeScript'))
    })

    it('returns answer for empty input', async () => {
      const plan = await classifyTask('')
      assert.equal(plan.strategy, 'single')
      assert.equal(plan.reason, 'Empty input')
    })

    it('returns answer when no model available', async () => {
      const plan = await classifyTask('审查代码')
      assert.equal(plan.strategy, 'single')
      assert.match(plan.reason, /no model/i)
    })
  })

  describe('complex task - LLM returns task plan', () => {
    it('returns parallel plan with tasks', async () => {
      const mockModel = createMockModel(JSON.stringify({
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Detected independent tasks',
        tasks: [
          { id: 'reviewer', description: 'Review code', tools: ['read_file'], depends_on: [] },
          { id: 'tester', description: 'Run tests', tools: ['run_command'], depends_on: [] },
        ],
      }))
      const plan = await classifyTask('审查 src/auth.ts，顺便跑一下测试', 0, mockModel)
      assert.equal(plan.strategy, 'parallel')
      assert.equal(plan.outputMode, 'stream')
      assert.equal(plan.tasks.length, 2)
      assert.equal(plan.answer, undefined)
    })

    it('returns sequential plan with dependent tasks', async () => {
      const mockModel = createMockModel(JSON.stringify({
        strategy: 'sequential',
        outputMode: 'collect',
        reason: 'Detected dependent tasks',
        tasks: [
          { id: 'agent-1', description: 'Refactor core', tools: ['read_file', 'write_file'], depends_on: [] },
          { id: 'agent-2', description: 'Update callers', tools: ['read_file', 'write_file'], depends_on: ['agent-1'] },
        ],
      }))
      const plan = await classifyTask('重构认证模块，同步修改所有调用方', 0, mockModel)
      assert.equal(plan.strategy, 'sequential')
      assert.equal(plan.outputMode, 'collect')
      assert.equal(plan.tasks.length, 2)
    })
  })

  describe('error handling', () => {
    it('falls back to single when LLM throws', async () => {
      const mockModel: ModelAdapter = {
        async next(): Promise<ModelResponse> {
          throw new Error('API error')
        },
      }
      const plan = await classifyTask('审查代码', 0, mockModel)
      assert.equal(plan.strategy, 'single')
    })

    it('falls back to single when context utilization too high', async () => {
      const mockModel = createMockModel(JSON.stringify({ strategy: 'parallel', tasks: [] }))
      const plan = await classifyTask('审查代码', 0.9, mockModel)
      assert.equal(plan.strategy, 'single')
      assert.match(plan.reason, /context utilization/i)
    })
  })
})

describe('decomposeTask', () => {
  describe('successful decomposition', () => {
    it('returns parallel plan with roles', async () => {
      const mockModel = createMockModel(JSON.stringify({
        strategy: 'parallel',
        reason: 'Independent tasks',
        tasks: [
          { id: 'reviewer', role: '安全审查员', description: '作为安全审查员，审查 src/auth.ts', tools: ['read_file'], depends_on: [] },
          { id: 'tester', role: '测试工程师', description: '作为测试工程师，运行测试', tools: ['run_command'], depends_on: [] },
        ],
      }))
      const { plan, error } = await decomposeTask('审查安全性并跑测试', mockModel)
      assert.equal(error, null)
      assert.ok(plan)
      assert.equal(plan!.strategy, 'parallel')
      assert.equal(plan!.outputMode, 'stream')
      assert.equal(plan!.tasks.length, 2)
      assert.equal(plan!.tasks[0]!.role, '安全审查员')
      assert.equal(plan!.tasks[1]!.role, '测试工程师')
    })

    it('returns sequential plan with dependencies', async () => {
      const mockModel = createMockModel(JSON.stringify({
        strategy: 'sequential',
        reason: 'Dependent tasks',
        tasks: [
          { id: 'agent-1', role: '架构分析师', description: '分析架构', tools: ['read_file'], depends_on: [] },
          { id: 'agent-2', role: '重构专家', description: '重构代码', tools: ['read_file', 'write_file'], depends_on: ['agent-1'] },
        ],
      }))
      const { plan, error } = await decomposeTask('分析架构后重构', mockModel)
      assert.equal(error, null)
      assert.ok(plan)
      assert.equal(plan!.strategy, 'sequential')
      assert.equal(plan!.outputMode, 'collect')
      assert.deepEqual(plan!.tasks[1]!.depends_on, ['agent-1'])
    })

    it('handles tasks without role (backward compatible)', async () => {
      const mockModel = createMockModel(JSON.stringify({
        strategy: 'parallel',
        reason: 'Tasks',
        tasks: [
          { id: 't1', description: 'Task 1', tools: ['read_file'], depends_on: [] },
        ],
      }))
      const { plan, error } = await decomposeTask('Do something', mockModel)
      assert.equal(error, null)
      assert.ok(plan)
      assert.equal(plan!.tasks[0]!.role, undefined)
    })
  })

  describe('error handling', () => {
    it('returns error for empty task', async () => {
      const mockModel = createMockModel('')
      const { plan, error } = await decomposeTask('', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
    })

    it('returns error when LLM returns plain text', async () => {
      const mockModel = createMockModel('This is not JSON')
      const { plan, error } = await decomposeTask('审查代码', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
      assert.ok(error.includes('did not return JSON'))
    })

    it('returns error when LLM returns empty content', async () => {
      const mockModel = createMockModel('')
      const { plan, error } = await decomposeTask('审查代码', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
    })

    it('returns error when LLM throws', async () => {
      const mockModel: ModelAdapter = {
        async next(): Promise<ModelResponse> {
          throw new Error('API error')
        },
      }
      const { plan, error } = await decomposeTask('审查代码', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
      assert.ok(error.includes('API error'))
    })

    it('returns error when LLM returns invalid JSON schema', async () => {
      const mockModel = createMockModel(JSON.stringify({ strategy: 'invalid', tasks: [] }))
      const { plan, error } = await decomposeTask('审查代码', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
    })

    it('returns error when tasks array is empty', async () => {
      const mockModel = createMockModel(JSON.stringify({
        strategy: 'parallel',
        reason: 'No tasks',
        tasks: [],
      }))
      const { plan, error } = await decomposeTask('审查代码', mockModel)
      assert.equal(plan, null)
      assert.ok(error)
    })
  })
})
