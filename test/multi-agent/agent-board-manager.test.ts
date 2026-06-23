import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AgentBoardManager } from '../../src/multi-agent/agent-board.js'

describe('AgentBoardManager', () => {
  describe('addAgent', () => {
    it('adds a single agent', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      const agents = manager.getAgents()
      assert.equal(agents.length, 1)
      assert.equal(agents[0]!.id, 'agent-1')
      assert.equal(agents[0]!.label, 'Reviewer')
      assert.equal(agents[0]!.task, 'Review code')
      assert.equal(agents[0]!.status, 'pending')
    })

    it('adds multiple agents', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.addAgent('agent-2', 'Tester', 'Run tests')
      manager.addAgent('agent-3', 'Fixer', 'Fix bugs')
      assert.equal(manager.getAgents().length, 3)
    })

    it('throws on duplicate id', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      assert.throws(() => {
        manager.addAgent('agent-1', 'Tester', 'Run tests')
      }, /already exists/)
    })
  })

  describe('updateAgent', () => {
    it('updates status', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.updateAgent('agent-1', { status: 'running' })
      assert.equal(manager.getAgent('agent-1')!.status, 'running')
    })

    it('updates current_tool', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.updateAgent('agent-1', { current_tool: 'read_file' })
      assert.equal(manager.getAgent('agent-1')!.current_tool, 'read_file')
    })

    it('updates result_summary', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.updateAgent('agent-1', { result_summary: 'No issues found' })
      assert.equal(manager.getAgent('agent-1')!.result_summary, 'No issues found')
    })

    it('updates label and task', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.updateAgent('agent-1', { label: 'Code Reviewer', task: 'Review auth module' })
      assert.equal(manager.getAgent('agent-1')!.label, 'Code Reviewer')
      assert.equal(manager.getAgent('agent-1')!.task, 'Review auth module')
    })

    it('throws on non-existent id', () => {
      const manager = new AgentBoardManager()
      assert.throws(() => {
        manager.updateAgent('nonexistent', { status: 'running' })
      }, /not found/)
    })
  })

  describe('removeAgent', () => {
    it('removes existing agent', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.removeAgent('agent-1')
      assert.equal(manager.getAgents().length, 0)
    })

    it('does not throw on non-existent agent', () => {
      const manager = new AgentBoardManager()
      assert.doesNotThrow(() => {
        manager.removeAgent('nonexistent')
      })
    })
  })

  describe('getAgent', () => {
    it('returns existing agent', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      const agent = manager.getAgent('agent-1')
      assert.ok(agent)
      assert.equal(agent!.id, 'agent-1')
    })

    it('returns undefined for non-existent agent', () => {
      const manager = new AgentBoardManager()
      assert.equal(manager.getAgent('nonexistent'), undefined)
    })
  })

  describe('reset', () => {
    it('clears all agents', () => {
      const manager = new AgentBoardManager()
      manager.addAgent('agent-1', 'Reviewer', 'Review code')
      manager.addAgent('agent-2', 'Tester', 'Run tests')
      manager.reset()
      assert.equal(manager.getAgents().length, 0)
    })
  })
})
