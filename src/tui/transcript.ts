import process from 'node:process'
import { charDisplayWidth, wrapPanelBodyLine, displayWidth } from './chrome.js'
import { renderMarkdownish } from './markdown.js'
import type { TranscriptEntry } from './types.js'
import {
  RESET, DIM, BOLD, REVERSE,
  FG_MUTED,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_RUNNING,
  ACCENT_PRIMARY, ACCENT_SECONDARY,
  CYAN,
  BG_USER, FG_DARK,
} from './colors.js'

export type TranscriptSelection = {
  startLine: number
  startCol: number
  endLine: number
  endCol: number
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '')
}

function truncateByWidth(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return ''
  if (displayWidth(str) <= maxWidth) return str
  const budget = Math.max(0, maxWidth - 3)
  let width = 0
  let result = ''
  for (const char of str) {
    const charWidth = charDisplayWidth(char)
    if (width + charWidth > budget) break
    result += char
    width += charWidth
  }
  return result + '...'
}

function sliceByDisplayColumns(input: string, startCol: number, endCol: number): string {
  if (startCol >= endCol) return ''

  let result = ''
  let col = 0
  for (const char of input) {
    const width = charDisplayWidth(char)
    const nextCol = col + width
    if (nextCol <= startCol) {
      col = nextCol
      continue
    }
    if (col >= endCol) {
      break
    }
    result += char
    col = nextCol
  }
  return result
}

function highlightRange(line: string, startCol: number, endCol: number): string {
  if (startCol >= endCol) return line

  let result = ''
  let visibleCol = 0
  let i = 0
  let highlighted = false

  while (i < line.length) {
    if (line[i] === '\u001b') {
      const escapeStart = i
      i++
      if (i < line.length && line[i] === '[') {
        i++
        while (i < line.length && (line[i] < '@' || line[i] > '~')) {
          i++
        }
        i++
      }
      const seq = line.slice(escapeStart, i)
      result += seq
      if (seq === '\u001b[0m' && highlighted) {
        result += REVERSE
      }
      continue
    }

    const char = line[i]
    const width = charDisplayWidth(char)

    if (!highlighted && visibleCol >= startCol) {
      result += REVERSE
      highlighted = true
    }

    if (!highlighted && visibleCol < startCol && visibleCol + width > startCol) {
      result += REVERSE
      highlighted = true
    }

    if (highlighted && visibleCol >= endCol) {
      result += RESET
      highlighted = false
    }

    result += char
    visibleCol += width
    i++

    if (highlighted && visibleCol >= endCol) {
      result += RESET
      highlighted = false
    }
  }

  if (highlighted) {
    result += RESET
  }

  return result
}

function indentBlock(input: string, prefix = '  '): string {
  return input
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 工具输出预览
// ═══════════════════════════════════════════════════════════════

function previewToolBody(toolName: string, body: string): string {
  const maxDisplayWidth = toolName === 'read_file' ? 1000 : 1800
  const maxLines = toolName === 'read_file' ? 20 : 36
  const lines = body.split('\n')
  const limitedLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines
  let limited = limitedLines.join('\n')

  if (displayWidth(limited) > maxDisplayWidth) {
    limited = `${truncateByWidth(limited, maxDisplayWidth)}`
  }

  if (limited !== body) {
    return `${limited}\n${DIM}... output truncated in transcript${RESET}`
  }

  return limited
}

// ═══════════════════════════════════════════════════════════════
// 边框字符常量
// ═══════════════════════════════════════════════════════════════

const BOX_INNER_WIDTH = 54

const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
} as const

// ═══════════════════════════════════════════════════════════════
// 多Agent面板渲染
// ═══════════════════════════════════════════════════════════════

function renderAgentBoard(agents: Array<{ id: string; label: string; task: string; status: string; current_tool?: string; result_summary?: string }>): string {
  if (agents.length === 0) return ''

  const bar = `${DIM}${BOX.vertical}${RESET} `
  const innerWidth = BOX_INNER_WIDTH
  const lines: string[] = []

  // 顶部边框 - 带标题
  const title = ' agents '
  const titleWidth = title.length
  const dashCount = Math.max(1, innerWidth - titleWidth - 2)
  lines.push(`${bar}${DIM}${BOX.topLeft}${BOLD}${ACCENT_PRIMARY}${title}${RESET}${DIM}${BOX.horizontal.repeat(dashCount)}${BOX.topRight}${RESET}`)

  // 每个 agent 行
  for (const agent of agents) {
    const icon = agent.status === 'running' ? `${STATUS_RUNNING}⚡${RESET}`
      : agent.status === 'done' ? `${STATUS_SUCCESS}✓${RESET}`
      : agent.status === 'error' ? `${STATUS_ERROR}✗${RESET}`
      : agent.status === 'waiting' ? `${DIM}⏳${RESET}`
      : `${DIM}○${RESET}`

    const statusColor = agent.status === 'running' ? STATUS_RUNNING
      : agent.status === 'done' ? STATUS_SUCCESS
      : agent.status === 'error' ? STATUS_ERROR
      : FG_MUTED

    const labelRaw = displayWidth(agent.label) > 12 ? truncateByWidth(agent.label, 10) : agent.label
    const taskRaw = displayWidth(agent.task) > 28 ? truncateByWidth(agent.task, 25) : agent.task
    const statusText = agent.status

    const content = `${icon} ${BOLD}${labelRaw}${RESET} ${taskRaw} ${statusColor}${statusText}${RESET}`
    const contentWidth = displayWidth(content)
    const padding = Math.max(1, innerWidth - 1 - contentWidth)

    lines.push(`${bar}${DIM}${BOX.vertical}${RESET} ${content}${' '.repeat(padding)}${DIM}${BOX.vertical}${RESET}`)
  }

  // 底部边框
  lines.push(`${bar}${DIM}${BOX.bottomLeft}${BOX.horizontal.repeat(innerWidth - 2)}${BOX.bottomRight}${RESET}`)

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 工具调用卡片渲染
// ═══════════════════════════════════════════════════════════════

function renderToolCard(entry: Extract<TranscriptEntry, { kind: 'tool' }>, _width?: number): string {
  const statusIcon = entry.status === 'success'
    ? `${STATUS_SUCCESS}✓${RESET}`
    : entry.status === 'error'
      ? `${STATUS_ERROR}✗${RESET}`
      : `${STATUS_RUNNING}⏳${RESET}`

  const durationStr = entry.duration !== undefined
    ? ` ${DIM}${entry.duration}ms${RESET}`
    : ''

  const body = entry.status === 'running'
    ? entry.body
    : entry.collapsed
      ? `${DIM}${entry.collapsedSummary ?? 'output collapsed'}${RESET}`
      : entry.collapsePhase
        ? `${DIM}collapsing${'.'.repeat(entry.collapsePhase)}${RESET}`
        : previewToolBody(entry.toolName, renderMarkdownish(entry.body))

  const contentLines = body.split('\n')
  const boxInnerWidth = BOX_INNER_WIDTH

  // 顶部边框 - 工具名称 + 状态
  const headerRight = `${statusIcon}${durationStr}`
  const toolNameWidth = displayWidth(entry.toolName)
  const headerRightWidth = displayWidth(entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '⏳') + (entry.duration !== undefined ? displayWidth(` ${entry.duration}ms`) : 0)
  const usedWidth = toolNameWidth + headerRightWidth + 6
  const headerDash = Math.max(1, boxInnerWidth - usedWidth)
  const header = `${DIM}${BOX.topLeft} ${BOLD}${entry.toolName}${RESET}${DIM} ${BOX.horizontal.repeat(headerDash)} ${headerRight} ${DIM}${BOX.topRight}${RESET}`

  // 内容行
  const rows = contentLines.map(line => {
    let w = displayWidth(line)
    let displayLine = line
    if (w > boxInnerWidth - 3) {
      displayLine = truncateByWidth(line, boxInnerWidth - 3)
      w = displayWidth(displayLine)
    }
    const pad = Math.max(0, boxInnerWidth - w - 1)
    return `${DIM}${BOX.vertical}${RESET} ${displayLine}${' '.repeat(pad)}${DIM}${BOX.vertical}${RESET}`
  })

  // 底部边框
  const footer = `${DIM}${BOX.bottomLeft}${BOX.horizontal.repeat(boxInnerWidth)}${BOX.bottomRight}${RESET}`

  const bar = `${ACCENT_PRIMARY}${BOX.vertical}${RESET} `
  return [`${bar}${header}`, ...rows.map(l => `${bar}${l}`), `${bar}${footer}`].join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 用户消息渲染
// ═══════════════════════════════════════════════════════════════

function renderUserMessage(entry: Extract<TranscriptEntry, { kind: 'user' }>, width?: number): string {
  const inner = (width ?? getTranscriptPanelWidth()) - 4
  const bar = ACCENT_PRIMARY + BOLD + '▌' + BG_USER + FG_DARK + ' '
  const emptyBar = ACCENT_PRIMARY + BOLD + '▌' + BG_USER + ' '
  const bodyLines = entry.body.replace(/\t/g, '    ').split('\n')
  const contentLines = bodyLines.map(line => {
    const content = bar + line
    const w = displayWidth(content)
    const pad = ' '.repeat(Math.max(0, inner - w))
    return BG_USER + content + pad + RESET
  })
  const emptyPad = ' '.repeat(Math.max(0, inner - 2))
  const emptyGray = BG_USER + emptyBar + emptyPad + RESET
  return [emptyGray, ...contentLines, emptyGray].join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 会话条目渲染
// ═══════════════════════════════════════════════════════════════

function renderTranscriptEntry(entry: TranscriptEntry, width?: number): string {
  if (entry.kind === 'user') {
    return renderUserMessage(entry, width)
  }

  if (entry.kind === 'assistant') {
    return indentBlock(renderMarkdownish(entry.body))
  }

  if (entry.kind === 'progress') {
    return `${STATUS_RUNNING}${BOLD}progress${RESET}\n${indentBlock(
      renderMarkdownish(entry.body),
    )}`
  }

  if (entry.kind === 'orchestrator') {
    return `${ACCENT_SECONDARY}${BOLD}orchestrator${RESET} ${DIM}${BOX.vertical}${RESET} ${indentBlock(renderMarkdownish(entry.body))}`
  }

  if (entry.kind === 'agent_message') {
    return `${CYAN}${BOLD}${entry.agentId}${RESET} ${DIM}${BOX.vertical}${RESET} ${indentBlock(renderMarkdownish(entry.body))}`
  }

  if (entry.kind === 'agent_board') {
    return renderAgentBoard(entry.agents)
  }

  // Tool entry
  return renderToolCard(entry, width)
}

// ═══════════════════════════════════════════════════════════════
// 会话面板宽度计算
// ═══════════════════════════════════════════════════════════════

function getTranscriptPanelWidth(): number {
  return Math.max(60, process.stdout.columns ?? 100)
}

export function getTranscriptWindowSize(windowSize?: number): number {
  if (windowSize !== undefined) {
    return Math.max(4, windowSize)
  }
  const rows = process.stdout.rows ?? 40
  return Math.max(8, rows - 15)
}

export function renderTranscriptLines(entries: TranscriptEntry[], width?: number): string[] {
  const rendered = entries.map(e => renderTranscriptEntry(e, width))
  const logicalLines: string[] = []

  rendered.forEach((block, index) => {
    if (index > 0) {
      logicalLines.push('')
    }

    logicalLines.push(...block.split('\n'))
  })

  const panelWidth = width ?? getTranscriptPanelWidth()
  return logicalLines.flatMap(line => wrapPanelBodyLine(line, panelWidth))
}

export function getTranscriptMaxScrollOffset(
  entries: TranscriptEntry[],
  windowSize?: number,
  width?: number,
): number {
  if (entries.length === 0) return 0
  const lines = renderTranscriptLines(entries, width)
  return Math.max(0, lines.length - getTranscriptWindowSize(windowSize))
}

export function renderTranscript(
  entries: TranscriptEntry[],
  scrollOffset: number,
  windowSize?: number,
  selection?: TranscriptSelection,
  width?: number,
): string {
  if (entries.length === 0) {
    return ''
  }

  let lines = renderTranscriptLines(entries, width)
  const pageSize = getTranscriptWindowSize(windowSize)
  const maxOffset = Math.max(0, lines.length - pageSize)
  const offset = Math.max(0, Math.min(scrollOffset, maxOffset))
  const end = lines.length - offset
  const start = Math.max(0, end - pageSize)

  if (selection) {
    lines = lines.map((line, index) => {
      if (index < selection.startLine || index > selection.endLine) {
        return line
      }
      if (index === selection.startLine && index === selection.endLine) {
        return highlightRange(line, selection.startCol, selection.endCol)
      }
      if (index === selection.startLine) {
        return highlightRange(line, selection.startCol, Infinity)
      }
      if (index === selection.endLine) {
        return highlightRange(line, 0, selection.endCol)
      }
      return highlightRange(line, 0, Infinity)
    })
  }

  const body = lines.slice(start, end).join('\n')

  if (offset === 0) {
    return body
  }

  return `${body}\n\n${DIM}scroll offset: ${offset}${RESET}`
}

export function extractSelectedText(
  entries: TranscriptEntry[],
  selection: TranscriptSelection,
  width?: number,
): string {
  const lines = renderTranscriptLines(entries, width)
  const { startLine, startCol, endLine, endCol } = selection

  const result: string[] = []
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    const plainLine = stripAnsi(lines[i] ?? '')
    if (i === startLine && i === endLine) {
      result.push(sliceByDisplayColumns(plainLine, startCol, endCol))
    } else if (i === startLine) {
      result.push(sliceByDisplayColumns(plainLine, startCol, Infinity))
    } else if (i === endLine) {
      result.push(sliceByDisplayColumns(plainLine, 0, endCol))
    } else {
      result.push(plainLine)
    }
  }
  return result.join('\n')
}
