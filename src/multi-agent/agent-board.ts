import type { AgentStatus, AgentState } from './types.js'

export class AgentBoardManager {
  private agents: Map<string, AgentStatus> = new Map()

  addAgent(id: string, label: string, task: string): void {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} already exists`)
    }
    this.agents.set(id, {
      id,
      label,
      task,
      status: 'pending',
    })
  }

  updateAgent(id: string, updates: Partial<Omit<AgentStatus, 'id'>>): void {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent ${id} not found`)
    }
    if (updates.label !== undefined) agent.label = updates.label
    if (updates.task !== undefined) agent.task = updates.task
    if (updates.status !== undefined) agent.status = updates.status
    if (updates.current_tool !== undefined) agent.current_tool = updates.current_tool
    if (updates.result_summary !== undefined) agent.result_summary = updates.result_summary
  }

  removeAgent(id: string): void {
    this.agents.delete(id)
  }

  getAgents(): AgentStatus[] {
    return Array.from(this.agents.values())
  }

  getAgent(id: string): AgentStatus | undefined {
    return this.agents.get(id)
  }

  reset(): void {
    this.agents.clear()
  }
}
