import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createOrchestrateTasksTool } from '../../src/tools/orchestrate-tasks.js'
import { ToolRegistry } from '../../src/core/tool-registry.js'
import type { ModelAdapter, ChatMessage, ModelResponse } from '../../src/core/types.js'
import type { AgentStatus } from '../../src/multi-agent/types.js'
import { z } from 'zod'

function createMockModel(response: string): ModelAdapter {
  return {
    async next(_messages: ChatMessage[]): Promise<ModelResponse> {
      return { type: 'assistant', content: response }
    },
  }
}

function createDecomposeModel(strategy: string, tasks: Array<{ id: string; role?: string; description: string; tools: string[]; depends_on: string[] }>): ModelAdapter {
  return {
    async next(messages: ChatMessage[]): Promise<ModelResponse> {
      // First call is decompose (system prompt contains "任务编排器")
      const systemMsg = messages.find(m => m.role === 'system')
      if (systemMsg && systemMsg.content.includes('任务编排器')) {
        return {
          type: 'assistant',
          content: JSON.stringify({
            strategy,
            reason: 'Test decomposition',
            tasks,
          }),
        }
      }
      // Subsequent calls are from sub-agents
      return { type: 'assistant', content: 'Task completed successfully' }
    },
  }
}

describe('orchestrate_tasks tool', () => {
  describe('tool definition', () => {
    it('has correct name and schema', () => {
      const tool = createOrchestrateTasksTool({
        model: createMockModel('test'),
        tools: new ToolRegistry([]),
      })
      assert.equal(tool.name, 'orchestrate_tasks')
      assert.ok(tool.description)
      assert.ok(tool.inputSchema.properties.task)
    })
  })

  describe('successful orchestration', () => {
    it('decomposes and executes parallel tasks', async () => {
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
    })

    it('decomposes and executes sequential tasks', async () => {
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

    it('returns error when decomposition fails', async () => {
      const model = createMockModel('This is not JSON')
      const tool = createOrchestrateTasksTool({ model, tools: new ToolRegistry([]) })
      const result = await tool.run(
        { task: '审查代码' },
        { cwd: '/tmp' },
      )

      assert.equal(result.ok, false)
      assert.ok(result.output.includes('任务拆分失败'))
    })

    it('returns error for empty task', async () => {
      const model = createMockModel('test')
      const tool = createOrchestrateTasksTool({ model, tools: new ToolRegistry([]) })
      const result = await tool.run(
        { task: '' },
        { cwd: '/tmp' },
      )

      assert.equal(result.ok, false)
    })
  })

  describe('board updates', () => {
    it('calls onBoardUpdate during execution', async () => {
      const model = createDecomposeModel('parallel', [
        { id: 't1', role: '审查员', description: '审查', tools: [], depends_on: [] },
      ])

      const boardSnapshots: AgentStatus[][] = []
      const tool = createOrchestrateTasksTool({
        model,
        tools: new ToolRegistry([]),
        onBoardUpdate: (agents) => boardSnapshots.push([...agents]),
      })

      await tool.run({ task: '审查代码' }, { cwd: '/tmp' })

      assert.ok(boardSnapshots.length > 0)
      const lastSnapshot = boardSnapshots[boardSnapshots.length - 1]!
      assert.ok(lastSnapshot.every(a => a.status === 'done'))
    })
  })

  describe('input validation', () => {
    it('rejects empty task', async () => {
      const tool = createOrchestrateTasksTool({
        model: createMockModel('test'),
        tools: new ToolRegistry([]),
      })

      // zod validation should fail for empty string
      const parsed = tool.schema.safeParse({ task: '' })
      assert.ok(!parsed.success)
    })

    it('accepts valid task', async () => {
      const tool = createOrchestrateTasksTool({
        model: createMockModel('test'),
        tools: new ToolRegistry([]),
      })

      const parsed = tool.schema.safeParse({ task: '审查代码' })
      assert.ok(parsed.success)
    })
  })
})
