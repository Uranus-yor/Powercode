import process from 'node:process'
import { charDisplayWidth, wrapPanelBodyLine, displayWidth, renderCard } from './chrome.js'
import { renderMarkdownish } from './markdown.js'
import type { TranscriptEntry } from './types.js'
import {
  RESET, DIM, BOLD, REVERSE,
  FG, FG_DIM, FG_BRIGHT,
  SUCCESS, ERROR, WARNING,
  ACCENT, ACCENT2,
  CYAN, USER_BG, BLACK,
  BORDER_DIM,
  stripAnsi,
} from './colors.js'

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

export type TranscriptSelection = {
  startLine: number; startCol: number; endLine: number; endCol: number
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function truncate(str: string, max: number): string {
  if (max <= 0) return ''
  if (displayWidth(str) <= max) return str
  const budget = Math.max(0, max - 3)
  let w = 0, result = ''
  for (const ch of str) {
    const cw = charDisplayWidth(ch)
    if (w + cw > budget) break
    result += ch; w += cw
  }
  return result + '...'
}

function sliceByDisplayColumns(input: string, startCol: number, endCol: number): string {
  if (startCol >= endCol) return ''
  let result = '', col = 0
  for (const ch of input) {
    const w = charDisplayWidth(ch), next = col + w
    if (next <= startCol) { col = next; continue }
    if (col >= endCol) break
    result += ch; col = next
  }
  return result
}

function highlightRange(line: string, startCol: number, endCol: number): string {
  if (startCol >= endCol) return line
  let result = '', vc = 0, i = 0, hl = false
  while (i < line.length) {
    if (line[i] === '\u001b') {
      const s = i; i++
      if (i < line.length && line[i] === '[') { i++; while (i < line.length && (line[i] < '@' || line[i] > '~')) i++; i++ }
      const seq = line.slice(s, i); result += seq
      if (seq === '\u001b[0m' && hl) result += REVERSE
      continue
    }
    const ch = line[i]!, w = charDisplayWidth(ch)
    if (!hl && vc >= startCol) { result += REVERSE; hl = true }
    if (!hl && vc < startCol && vc + w > startCol) { result += REVERSE; hl = true }
    if (hl && vc >= endCol) { result += RESET; hl = false }
    result += ch; vc += w; i++
    if (hl && vc >= endCol) { result += RESET; hl = false }
  }
  if (hl) result += RESET
  return result
}

function indentBlock(input: string, prefix = '  '): string {
  return input.split('\n').map(l => `${prefix}${l}`).join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 工具输出预览
// ═══════════════════════════════════════════════════════════════

function previewBody(toolName: string, body: string): string {
  const maxW = toolName === 'read_file' ? 1000 : 1800
  const maxL = toolName === 'read_file' ? 20 : 36
  const lines = body.split('\n')
  const limited = lines.length > maxL ? lines.slice(0, maxL) : lines
  let result = limited.join('\n')
  if (displayWidth(result) > maxW) result = truncate(result, maxW)
  if (result !== body) return `${result}\n${DIM}... output truncated${RESET}`
  return result
}

// ═══════════════════════════════════════════════════════════════
// 卡片宽度 - 统一控制
// ═══════════════════════════════════════════════════════════════

function getCardWidth(): number {
  const terminal = process.stdout.columns ?? 80
  // 卡片最大60字符宽，居中显示
  return Math.min(60, terminal)
}

// ═══════════════════════════════════════════════════════════════
// 多Agent面板
// ═══════════════════════════════════════════════════════════════

function renderAgentBoard(agents: Array<{ id: string; label: string; task: string; status: string; current_tool?: string; result_summary?: string }>): string {
  if (agents.length === 0) return ''

  const w = getCardWidth()
  const lines: string[] = []

  for (const agent of agents) {
    const icon = agent.status === 'running' ? `${WARNING}\u26a1${RESET}`
      : agent.status === 'done' ? `${SUCCESS}\u2713${RESET}`
      : agent.status === 'error' ? `${ERROR}\u2717${RESET}`
      : agent.status === 'waiting' ? `${DIM}\u23f3${RESET}`
      : `${DIM}\u25cb${RESET}`

    const statusColor = agent.status === 'running' ? WARNING
      : agent.status === 'done' ? SUCCESS
      : agent.status === 'error' ? ERROR : FG_DIM

    const label = truncate(agent.label, 12)
    const task = truncate(agent.task, 28)
    lines.push(`${icon} ${BOLD}${label}${RESET} ${task} ${statusColor}${agent.status}${RESET}`)
  }

  return renderCard('agents', lines, w)
}

// ═══════════════════════════════════════════════════════════════
// 工具调用卡片
// ═══════════════════════════════════════════════════════════════

function renderToolCard(entry: Extract<TranscriptEntry, { kind: 'tool' }>): string {
  const statusIcon = entry.status === 'success' ? `${SUCCESS}\u2713${RESET}`
    : entry.status === 'error' ? `${ERROR}\u2717${RESET}`
    : `${WARNING}\u23f3${RESET}`

  const durationStr = entry.duration !== undefined ? ` ${DIM}${entry.duration}ms${RESET}` : ''

  const body = entry.status === 'running' ? entry.body
    : entry.collapsed ? `${DIM}${entry.collapsedSummary ?? 'output collapsed'}${RESET}`
    : entry.collapsePhase ? `${DIM}collapsing${'.'.repeat(entry.collapsePhase)}${RESET}`
    : previewBody(entry.toolName, renderMarkdownish(entry.body))

  const contentLines = body.split('\n')
  const w = getCardWidth()

  return renderCard(entry.toolName, contentLines, w, `${statusIcon}${durationStr}`)
}

// ═══════════════════════════════════════════════════════════════
// 用户消息 - 左侧色条设计
// ═══════════════════════════════════════════════════════════════

function renderUserMessage(entry: Extract<TranscriptEntry, { kind: 'user' }>, width?: number): string {
  const panelWidth = (width ?? process.stdout.columns ?? 80) - 2
  const bodyLines = entry.body.replace(/\t/g, '    ').split('\n')

  // 左侧色条: ▌ + 内容
  return bodyLines.map(line => {
    return `${ACCENT}${BOLD}\u258c${RESET} ${line}`
  }).join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 会话条目渲染
// ═══════════════════════════════════════════════════════════════

function renderTranscriptEntry(entry: TranscriptEntry, width?: number): string {
  switch (entry.kind) {
    case 'user':
      return renderUserMessage(entry, width)
    case 'assistant':
      return indentBlock(renderMarkdownish(entry.body))
    case 'progress':
      return `${DIM}\u25b6 progress${RESET}\n${indentBlock(renderMarkdownish(entry.body))}`
    case 'orchestrator':
      return `${ACCENT2}${BOLD}\u2699 orchestrator${RESET}\n${indentBlock(renderMarkdownish(entry.body))}`
    case 'agent_message':
      return `${CYAN}${BOLD}${entry.agentId}${RESET}\n${indentBlock(renderMarkdownish(entry.body))}`
    case 'agent_board':
      return renderAgentBoard(entry.agents)
    case 'tool':
      return renderToolCard(entry)
  }
}

// ═══════════════════════════════════════════════════════════════
// 会话窗口计算
// ═══════════════════════════════════════════════════════════════

function getTranscriptPanelWidth(): number {
  return Math.max(60, process.stdout.columns ?? 100)
}

export function getTranscriptWindowSize(windowSize?: number): number {
  if (windowSize !== undefined) return Math.max(4, windowSize)
  const rows = process.stdout.rows ?? 40
  return Math.max(8, rows - 18)
}

export function renderTranscriptLines(entries: TranscriptEntry[], width?: number): string[] {
  const rendered = entries.map(e => renderTranscriptEntry(e, width))
  const logical: string[] = []
  rendered.forEach((block, i) => {
    if (i > 0) logical.push('')
    logical.push(...block.split('\n'))
  })
  const panelWidth = width ?? getTranscriptPanelWidth()
  return logical.flatMap(l => wrapPanelBodyLine(l, panelWidth))
}

export function getTranscriptMaxScrollOffset(entries: TranscriptEntry[], windowSize?: number, width?: number): number {
  if (entries.length === 0) return 0
  const lines = renderTranscriptLines(entries, width)
  return Math.max(0, lines.length - getTranscriptWindowSize(windowSize))
}

export function renderTranscript(
  entries: TranscriptEntry[], scrollOffset: number, windowSize?: number,
  selection?: TranscriptSelection, width?: number,
): string {
  if (entries.length === 0) return ''

  let lines = renderTranscriptLines(entries, width)
  const pageSize = getTranscriptWindowSize(windowSize)
  const maxOffset = Math.max(0, lines.length - pageSize)
  const offset = Math.max(0, Math.min(scrollOffset, maxOffset))
  const end = lines.length - offset
  const start = Math.max(0, end - pageSize)

  if (selection) {
    lines = lines.map((line, i) => {
      if (i < selection.startLine || i > selection.endLine) return line
      if (i === selection.startLine && i === selection.endLine) return highlightRange(line, selection.startCol, selection.endCol)
      if (i === selection.startLine) return highlightRange(line, selection.startCol, Infinity)
      if (i === selection.endLine) return highlightRange(line, 0, selection.endCol)
      return highlightRange(line, 0, Infinity)
    })
  }

  const body = lines.slice(start, end).join('\n')
  if (offset === 0) return body
  return `${body}\n\n${DIM}scroll: ${offset}${RESET}`
}

export function extractSelectedText(entries: TranscriptEntry[], selection: TranscriptSelection, width?: number): string {
  const lines = renderTranscriptLines(entries, width)
  const { startLine, startCol, endLine, endCol } = selection
  const result: string[] = []
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    const plain = stripAnsi(lines[i] ?? '')
    if (i === startLine && i === endLine) result.push(sliceByDisplayColumns(plain, startCol, endCol))
    else if (i === startLine) result.push(sliceByDisplayColumns(plain, startCol, Infinity))
    else if (i === endLine) result.push(sliceByDisplayColumns(plain, 0, endCol))
    else result.push(plain)
  }
  return result.join('\n')
}
