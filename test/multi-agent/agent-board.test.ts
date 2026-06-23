import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { TranscriptEntry } from '../../src/tui/types.js'
import type { AgentStatus } from '../../src/multi-agent/types.js'
import { renderTranscriptLines } from '../../src/tui/transcript.js'

function createAgentBoardEntry(agents: AgentStatus[]): TranscriptEntry {
  return { id: 1, kind: 'agent_board', agents }
}

function createOrchestratorEntry(body: string): TranscriptEntry {
  return { id: 2, kind: 'orchestrator', body }
}

function createAgentMessageEntry(agentId: string, body: string): TranscriptEntry {
  return { id: 3, kind: 'agent_message', agentId, body }
}

describe('Agent Board rendering', () => {
  describe('renderAgentBoard', () => {
    it('renders empty board', () => {
      const entry = createAgentBoardEntry([])
      const lines = renderTranscriptLines([entry])
      assert.ok(lines.length > 0)
    })

    it('renders single agent', () => {
      const agents: AgentStatus[] = [
        { id: 'agent-1', label: 'Reviewer', task: 'Review code', status: 'running' },
      ]
      const entry = createAgentBoardEntry(agents)
      const lines = renderTranscriptLines([entry])
      const output = lines.join('\n')
      assert.ok(output.includes('Reviewer'))
      assert.ok(output.includes('running'))
    })

    it('renders multiple agents with different statuses', () => {
      const agents: AgentStatus[] = [
        { id: 'agent-1', label: 'Reviewer', task: 'Review code', status: 'running' },
        { id: 'agent-2', label: 'Tester', task: 'Run tests', status: 'done' },
        { id: 'agent-3', label: 'Fixer', task: 'Fix bugs', status: 'error' },
      ]
      const entry = createAgentBoardEntry(agents)
      const lines = renderTranscriptLines([entry])
      const output = lines.join('\n')
      assert.ok(output.includes('Reviewer'))
      assert.ok(output.includes('Tester'))
      assert.ok(output.includes('Fixer'))
      assert.ok(output.includes('running'))
      assert.ok(output.includes('done'))
      assert.ok(output.includes('error'))
    })

    it('renders board with waiting agent', () => {
      const agents: AgentStatus[] = [
        { id: 'agent-1', label: 'Worker', task: 'Do something', status: 'waiting' },
      ]
      const entry = createAgentBoardEntry(agents)
      const lines = renderTranscriptLines([entry])
      const output = lines.join('\n')
      assert.ok(output.includes('waiting'))
    })

    it('renders board with pending agent', () => {
      const agents: AgentStatus[] = [
        { id: 'agent-1', label: 'Worker', task: 'Do something', status: 'pending' },
      ]
      const entry = createAgentBoardEntry(agents)
      const lines = renderTranscriptLines([entry])
      const output = lines.join('\n')
      assert.ok(output.includes('pending'))
    })
  })

  describe('renderOrchestrator', () => {
    it('renders orchestrator message', () => {
      const entry = createOrchestratorEntry('Planning tasks...')
      const lines = renderTranscriptLines([entry])
      const output = lines.join('\n')
      assert.ok(output.includes('orchestrator'))
      assert.ok(output.includes('Planning tasks...'))
    })
  })

  describe('renderAgentMessage', () => {
    it('renders agent message with agentId', () => {
      const entry = createAgentMessageEntry('reviewer', 'Found 2 issues')
      const lines = renderTranscriptLines([entry])
      const output = lines.join('\n')
      assert.ok(output.includes('reviewer'))
      assert.ok(output.includes('Found 2 issues'))
    })
  })

  describe('mixed entries', () => {
    it('renders mixed user/orchestrator/agent_board entries', () => {
      const entries: TranscriptEntry[] = [
        { id: 1, kind: 'user', body: 'Review code and run tests' },
        createOrchestratorEntry('Planning 2 tasks...'),
        createAgentBoardEntry([
          { id: 'agent-1', label: 'Reviewer', task: 'Review', status: 'running' },
          { id: 'agent-2', label: 'Tester', task: 'Test', status: 'running' },
        ]),
        createAgentMessageEntry('reviewer', 'No issues found'),
      ]
      const lines = renderTranscriptLines(entries)
      const output = lines.join('\n')
      assert.ok(output.includes('Review code and run tests'))
      assert.ok(output.includes('orchestrator'))
      assert.ok(output.includes('Reviewer'))
      assert.ok(output.includes('reviewer'))
    })
  })
})
