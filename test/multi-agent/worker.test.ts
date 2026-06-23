import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from '../../src/multi-agent/worker.js'
import { ToolRegistry } from '../../src/core/tool-registry.js'
import type { ModelAdapter, ChatMessage, ModelResponse } from '../../src/core/types.js'
import type { AgentEvent } from '../../src/multi-agent/types.js'
import { z } from 'zod'

function createMockModel(response: ModelResponse): ModelAdapter {
  return {
    async next(_messages: ChatMessage[]): Promise<ModelResponse> {
      return response
    },
  }
}

function createMockTool(name: string) {
  return {
    name,
    description: `Mock ${name}`,
    inputSchema: {},
    schema: z.object({}),
    run: async () => ({ ok: true, output: `${name} done` }),
  }
}

describe('Worker', () => {
  it('creates with correct id and label', () => {
    const model = createMockModel({ type: 'assistant', content: 'done' })
    const tools = new ToolRegistry([])
    const worker = new Worker({
      id: 'worker-1',
      label: 'Reviewer',
      cwd: '/tmp',
      model,
      tools,
    })
    assert.equal(worker.id, 'worker-1')
    assert.equal(worker.label, 'Reviewer')
  })

  it('runs a task and returns successful result', async () => {
    const model = createMockModel({ type: 'assistant', content: 'Review completed' })
    const mockTool = createMockTool('read_file')
    const tools = new ToolRegistry([mockTool])
    const worker = new Worker({
      id: 'worker-1',
      label: 'Reviewer',
      cwd: '/tmp',
      model,
      tools,
    })

    const result = await worker.run({
      id: 't1',
      description: 'Review code',
      tools: ['read_file'],
      depends_on: [],
    })

    assert.equal(result.agentId, 'worker-1')
    assert.equal(result.success, true)
    assert.ok(result.output.includes('Review completed'))
    assert.ok(result.duration >= 0)
  })

  it('emits events during execution', async () => {
    const model = createMockModel({ type: 'assistant', content: 'Done' })
    const tools = new ToolRegistry([])
    const worker = new Worker({
      id: 'worker-1',
      label: 'Tester',
      cwd: '/tmp',
      model,
      tools,
    })

    const events: AgentEvent[] = []
    await worker.run(
      { id: 't1', description: 'Run tests', tools: [], depends_on: [] },
      (event) => events.push(event),
    )

    assert.ok(events.length >= 2)
    assert.equal(events[0]!.type, 'started')
    assert.equal(events[0]!.agentId, 'worker-1')
    assert.equal(events[events.length - 1]!.type, 'completed')
  })

  it('handles model errors gracefully', async () => {
    const model: ModelAdapter = {
      async next(): Promise<ModelResponse> {
        throw new Error('API rate limited')
      },
    }
    const tools = new ToolRegistry([])
    const worker = new Worker({
      id: 'worker-1',
      label: 'Worker',
      cwd: '/tmp',
      model,
      tools,
    })

    const result = await worker.run({
      id: 't1',
      description: 'Do something',
      tools: [],
      depends_on: [],
    })

    assert.equal(result.success, false)
    assert.equal(result.error, 'API rate limited')
  })

  it('emits error event on failure', async () => {
    const model: ModelAdapter = {
      async next(): Promise<ModelResponse> {
        throw new Error('Network error')
      },
    }
    const tools = new ToolRegistry([])
    const worker = new Worker({
      id: 'worker-1',
      label: 'Worker',
      cwd: '/tmp',
      model,
      tools,
    })

    const events: AgentEvent[] = []
    await worker.run(
      { id: 't1', description: 'Task', tools: [], depends_on: [] },
      (event) => events.push(event),
    )

    const errorEvent = events.find(e => e.type === 'error')
    assert.ok(errorEvent)
    assert.equal(errorEvent!.type, 'error')
    if (errorEvent!.type === 'error') {
      assert.equal(errorEvent!.error, 'Network error')
    }
  })
})
