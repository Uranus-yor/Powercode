import type { AgentStatus } from '../multi-agent/types.js'

export type TranscriptEntry =
  | {
      id: number
      kind: 'user'
      body: string
    }
  | {
      id: number
      kind: 'assistant'
      body: string
    }
  | {
      id: number
      kind: 'progress'
      body: string
    }
  | {
      id: number
      kind: 'tool'
      toolName: string
      status: 'running' | 'success' | 'error'
      body: string
      collapsed?: boolean
      collapsedSummary?: string
      collapsePhase?: 1 | 2 | 3
      duration?: number
    }
  | {
      id: number
      kind: 'orchestrator'
      body: string
    }
  | {
      id: number
      kind: 'agent_message'
      agentId: string
      body: string
    }
  | {
      id: number
      kind: 'agent_board'
      agents: AgentStatus[]
    }
