import type { McpServerSummary } from './mcp.js'

/** MCP 状态摘要类型 */
export type McpStatusSummary = {
  total: number
  connected: number
  connecting: number
  error: number
  toolCount: number
}

/**
 * 汇总 MCP 服务器状态
 * 统计各状态的服务器数量和工具总数
 */
export function summarizeMcpServers(
  mcpServers: McpServerSummary[],
): McpStatusSummary {
  return mcpServers.reduce<McpStatusSummary>(
    (summary, server) => {
      summary.total += 1
      summary.toolCount += server.toolCount
      if (server.status === 'connected') {
        summary.connected += 1
      } else if (server.status === 'connecting') {
        summary.connecting += 1
      } else if (server.status === 'error') {
        summary.error += 1
      }
      return summary
    },
    {
      total: 0,
      connected: 0,
      connecting: 0,
      error: 0,
      toolCount: 0,
    },
  )
}
