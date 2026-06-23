import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type {
  TaskPlan,
  SubTask,
  AgentStatus,
  AgentEvent,
  AgentResult,
  Strategy,
  OutputMode,
  AgentState,
} from '../../src/multi-agent/types.js'

describe('Multi-Agent Types', () => {
  describe('TaskPlan', () => {
    it('creates TaskPlan with strategy=single', () => {
      const plan: TaskPlan = {
        strategy: 'single',
        outputMode: 'stream',
        reason: 'Simple task',
        tasks: [],
      }
      assert.equal(plan.strategy, 'single')
      assert.equal(plan.outputMode, 'stream')
      assert.equal(plan.reason, 'Simple task')
      assert.deepEqual(plan.tasks, [])
    })

    it('creates TaskPlan with strategy=parallel', () => {
      const plan: TaskPlan = {
        strategy: 'parallel',
        outputMode: 'stream',
        reason: 'Independent tasks',
        tasks: [],
      }
      assert.equal(plan.strategy, 'parallel')
    })

    it('creates TaskPlan with strategy=sequential', () => {
      const plan: TaskPlan = {
        strategy: 'sequential',
        outputMode: 'collect',
        reason: 'Dependent tasks',
        tasks: [],
      }
      assert.equal(plan.strategy, 'sequential')
      assert.equal(plan.outputMode, 'collect')
    })

    it('accepts both outputMode values', () => {
      const stream: OutputMode = 'stream'
      const collect: OutputMode = 'collect'
      assert.equal(stream, 'stream')
      assert.equal(collect, 'collect')
    })
  })

  describe('SubTask', () => {
    it('creates SubTask without dependencies', () => {
      const task: SubTask = {
        id: 't1',
        description: 'Review code',
        tools: ['read_file', 'grep_files'],
        depends_on: [],
      }
      assert.equal(task.id, 't1')
      assert.equal(task.description, 'Review code')
      assert.deepEqual(task.tools, ['read_file', 'grep_files'])
      assert.deepEqual(task.depends_on, [])
    })

    it('creates SubTask with dependencies', () => {
      const task: SubTask = {
        id: 't2',
        description: 'Update callers',
        tools: ['read_file', 'write_file'],
        depends_on: ['t1'],
      }
      assert.deepEqual(task.depends_on, ['t1'])
    })

    it('creates SubTask with target_files', () => {
      const task: SubTask = {
        id: 't3',
        description: 'Refactor auth',
        tools: ['read_file', 'edit_file'],
        depends_on: [],
        target_files: ['src/auth.ts', 'src/middleware.ts'],
      }
      assert.deepEqual(task.target_files, ['src/auth.ts', 'src/middleware.ts'])
    })

    it('creates SubTask without target_files', () => {
      const task: SubTask = {
        id: 't4',
        description: 'Run tests',
        tools: ['run_command'],
        depends_on: [],
      }
      assert.equal(task.target_files, undefined)
    })

    it('creates SubTask with role', () => {
      const task: SubTask = {
        id: 't5',
        description: '审查 src/auth.ts 的安全性',
        tools: ['read_file', 'grep_files'],
        depends_on: [],
        role: '安全审查员',
      }
      assert.equal(task.role, '安全审查员')
    })

    it('creates SubTask without role (backward compatible)', () => {
      const task: SubTask = {
        id: 't6',
        description: 'Run tests',
        tools: ['run_command'],
        depends_on: [],
      }
      assert.equal(task.role, undefined)
    })
  })

  describe('AgentStatus', () => {
    it('creates AgentStatus with pending state', () => {
      const status: AgentStatus = {
        id: 'agent-1',
        label: 'Reviewer',
        task: 'Review auth.ts',
        status: 'pending',
      }
      assert.equal(status.status, 'pending')
      assert.equal(status.current_tool, undefined)
      assert.equal(status.result_summary, undefined)
    })

    it('creates AgentStatus with running state and current_tool', () => {
      const status: AgentStatus = {
        id: 'agent-1',
        label: 'Reviewer',
        task: 'Review auth.ts',
        status: 'running',
        current_tool: 'read_file',
      }
      assert.equal(status.status, 'running')
      assert.equal(status.current_tool, 'read_file')
    })

    it('creates AgentStatus with done state and result_summary', () => {
      const status: AgentStatus = {
        id: 'agent-1',
        label: 'Reviewer',
        task: 'Review auth.ts',
        status: 'done',
        result_summary: 'No issues found',
      }
      assert.equal(status.status, 'done')
      assert.equal(status.result_summary, 'No issues found')
    })

    it('accepts all AgentState values', () => {
      const states: AgentState[] = ['pending', 'waiting', 'running', 'done', 'error']
      for (const state of states) {
        const status: AgentStatus = {
          id: 'test',
          label: 'Test',
          task: 'Test',
          status: state,
        }
        assert.equal(status.status, state)
      }
    })
  })

  describe('AgentEvent', () => {
    it('creates started event', () => {
      const event: AgentEvent = {
        type: 'started',
        agentId: 'agent-1',
        task: 'Review code',
        timestamp: Date.now(),
      }
      assert.equal(event.type, 'started')
    })

    it('creates progress event', () => {
      const event: AgentEvent = {
        type: 'progress',
        agentId: 'agent-1',
        toolName: 'read_file',
        message: 'Reading file',
        timestamp: Date.now(),
      }
      assert.equal(event.type, 'progress')
      assert.equal(event.toolName, 'read_file')
    })

    it('creates completed event', () => {
      const result: AgentResult = {
        agentId: 'agent-1',
        success: true,
        output: 'Done',
        toolCalls: 3,
        duration: 1500,
      }
      const event: AgentEvent = {
        type: 'completed',
        agentId: 'agent-1',
        result,
        timestamp: Date.now(),
      }
      assert.equal(event.type, 'completed')
      assert.equal(event.result.success, true)
    })

    it('creates error event', () => {
      const event: AgentEvent = {
        type: 'error',
        agentId: 'agent-1',
        error: 'Tool execution failed',
        timestamp: Date.now(),
      }
      assert.equal(event.type, 'error')
      assert.equal(event.error, 'Tool execution failed')
    })
  })

  describe('AgentResult', () => {
    it('creates successful result', () => {
      const result: AgentResult = {
        agentId: 'agent-1',
        success: true,
        output: 'Review completed',
        toolCalls: 5,
        duration: 2000,
      }
      assert.equal(result.success, true)
      assert.equal(result.error, undefined)
    })

    it('creates failed result', () => {
      const result: AgentResult = {
        agentId: 'agent-1',
        success: false,
        output: '',
        toolCalls: 2,
        duration: 500,
        error: 'Permission denied',
      }
      assert.equal(result.success, false)
      assert.equal(result.error, 'Permission denied')
    })
  })
})
