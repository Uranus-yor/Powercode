import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { TranscriptEntry } from '../../src/tui/types.js'
import type { AgentStatus } from '../../src/multi-agent/types.js'

describe('TranscriptEntry multi-agent types', () => {
  describe('existing types', () => {
    it('creates user entry', () => {
      const entry: TranscriptEntry = { id: 1, kind: 'user', body: 'Hello' }
      assert.equal(entry.kind, 'user')
      assert.equal(entry.body, 'Hello')
    })

    it('creates assistant entry', () => {
      const entry: TranscriptEntry = { id: 2, kind: 'assistant', body: 'Hi there' }
      assert.equal(entry.kind, 'assistant')
    })

    it('creates progress entry', () => {
      const entry: TranscriptEntry = { id: 3, kind: 'progress', body: 'Working...' }
      assert.equal(entry.kind, 'progress')
    })

    it('creates tool entry', () => {
      const entry: TranscriptEntry = {
        id: 4,
        kind: 'tool',
        toolName: 'read_file',
        status: 'success',
        body: 'file content',
      }
      assert.equal(entry.kind, 'tool')
      assert.equal(entry.toolName, 'read_file')
    })
  })

  describe('new multi-agent types', () => {
    it('creates orchestrator entry', () => {
      const entry: TranscriptEntry = {
        id: 5,
        kind: 'orchestrator',
        body: 'Planning tasks...',
      }
      assert.equal(entry.kind, 'orchestrator')
      assert.equal(entry.body, 'Planning tasks...')
    })

    it('creates agent_message entry', () => {
      const entry: TranscriptEntry = {
        id: 6,
        kind: 'agent_message',
        agentId: 'reviewer',
        body: 'Found 2 issues',
      }
      assert.equal(entry.kind, 'agent_message')
      assert.equal(entry.agentId, 'reviewer')
    })

    it('creates agent_board entry', () => {
      const agents: AgentStatus[] = [
        { id: 'agent-1', label: 'Reviewer', task: 'Review code', status: 'running' },
        { id: 'agent-2', label: 'Tester', task: 'Run tests', status: 'done' },
      ]
      const entry: TranscriptEntry = {
        id: 7,
        kind: 'agent_board',
        agents,
      }
      assert.equal(entry.kind, 'agent_board')
      assert.equal(entry.agents.length, 2)
      assert.equal(entry.agents[0]!.status, 'running')
      assert.equal(entry.agents[1]!.status, 'done')
    })

    it('creates agent_board with empty agents', () => {
      const entry: TranscriptEntry = {
        id: 8,
        kind: 'agent_board',
        agents: [],
      }
      assert.equal(entry.kind, 'agent_board')
      assert.equal(entry.agents.length, 0)
    })
  })

  describe('type guards', () => {
    it('isAgentBoard', () => {
      const entry: TranscriptEntry = {
        id: 1,
        kind: 'agent_board',
        agents: [],
      }
      assert.equal(entry.kind === 'agent_board', true)
    })

    it('isOrchestrator', () => {
      const entry: TranscriptEntry = {
        id: 1,
        kind: 'orchestrator',
        body: 'test',
      }
      assert.equal(entry.kind === 'orchestrator', true)
    })

    it('isAgentMessage', () => {
      const entry: TranscriptEntry = {
        id: 1,
        kind: 'agent_message',
        agentId: 'test',
        body: 'test',
      }
      assert.equal(entry.kind === 'agent_message', true)
    })
  })
})
