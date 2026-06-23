import process from 'node:process'
import { charDisplayWidth, wrapPanelBodyLine, displayWidth } from './chrome.js'
import { renderMarkdownish } from './markdown.js'
import type { TranscriptEntry } from './types.js'
import {
  RESET, DIM, CYAN, GREEN, YELLOW, RED, MAGENTA, BOLD, BLUE, REVERSE,
  BRIGHT_GREEN, DEEP_BLUE, USER_BG, BLACK,
} from './colors.js'

export type TranscriptSelection = {
  startLine: number
  startCol: number
  endLine: number
  endCol: number
}

function stripAnsi(str: string): string {
  return str.replace(/\[[\d;]*[A-Za-z]/g, '')
}

/** 按显示宽度截断字符串，中文字符占 2 个宽度 */
function truncateByWidth(str: string, maxWidth: number): string {
  let width = 0
  let result = ''
  for (const char of str) {
    const charWidth = charDisplayWidth(char)
    if (width + charWidth > maxWidth) break
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
    if (line[i] === '') {
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
      if (seq === '[0m' && highlighted) {
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

function previewToolBody(toolName: string, body: string): string {
  const maxChars = toolName === 'read_file' ? 1000 : 1800
  const maxLines = toolName === 'read_file' ? 20 : 36
  const lines = body.split('\n')
  const limitedLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines
  let limited = limitedLines.join('\n')

  if (limited.length > maxChars) {
    limited = `${limited.slice(0, maxChars)}...`
  }

  if (limited !== body) {
    return `${limited}\n${DIM}... output truncated in transcript${RESET}`
  }

  return limited
}

const BOX_INNER_WIDTH = 56  // 统一的盒子内部宽度

function renderAgentBoard(agents: Array<{ id: string; label: string; task: string; status: string; current_tool?: string; result_summary?: string }>): string {
  if (agents.length === 0) return ''

  const bar = `${DIM}│${RESET} `
  const innerWidth = BOX_INNER_WIDTH
  const lines: string[] = []

  // 顶边框
  lines.push(`${bar}${DIM}┌─ agents ${'─'.repeat(innerWidth - 10)}┐${RESET}`)

  // 每个 agent 行：先渲染内容，再测量宽度，最后填充
  for (const agent of agents) {
    const icon = agent.status === 'running' ? `${YELLOW}⚡${RESET}`
      : agent.status === 'done' ? `${GREEN}✓${RESET}`
      : agent.status === 'error' ? `${RED}✗${RESET}`
      : agent.status === 'waiting' ? `${DIM}⏳${RESET}`
      : `${DIM}○${RESET}`

    const statusColor = agent.status === 'running' ? YELLOW
      : agent.status === 'done' ? GREEN
      : agent.status === 'error' ? RED
      : DIM

    // 截断（按显示宽度）
    const labelRaw = displayWidth(agent.label) > 12 ? truncateByWidth(agent.label, 10) : agent.label
    const taskRaw = displayWidth(agent.task) > 28 ? truncateByWidth(agent.task, 25) : agent.task
    const statusText = agent.status

    // 渲染内容（不含右边框）
    const content = `${icon} ${BOLD}${labelRaw}${RESET} ${taskRaw} ${statusColor}${statusText}${RESET}`
    // 测量实际显示宽度（去掉 ANSI 码）
    const contentWidth = displayWidth(content)
    // 填充到 innerWidth - 1（留 1 给右边框）
    const padding = Math.max(1, innerWidth - 1 - contentWidth)

    lines.push(`${bar}${DIM}│${RESET} ${content}${' '.repeat(padding)}${DIM}│${RESET}`)
  }

  // 底边框
  lines.push(`${bar}${DIM}└${'─'.repeat(innerWidth)}┘${RESET}`)

  return lines.join('\n')
}

function renderTranscriptEntry(entry: TranscriptEntry): string {
  if (entry.kind === 'user') {
    const inner = getTranscriptPanelWidth() - 4
    const bar = DEEP_BLUE + BOLD + '▌' + USER_BG + BLACK + ' '
    const emptyBar = DEEP_BLUE + BOLD + '▌' + USER_BG + ' '
    const bodyLines = entry.body.split('\n')
    const contentLines = bodyLines.map(line => {
      const content = bar + line
      const w = displayWidth(content)
      const pad = ' '.repeat(Math.max(0, inner - w))
      return USER_BG + content + pad + RESET
    })
    const emptyPad = ' '.repeat(Math.max(0, inner - 2))
    const emptyGray = USER_BG + emptyBar + emptyPad + RESET
    return [emptyGray, ...contentLines, emptyGray].join('\n')
  }

  if (entry.kind === 'assistant') {
    return indentBlock(renderMarkdownish(entry.body))
  }

  if (entry.kind === 'progress') {
    return `${YELLOW}${BOLD}progress${RESET}\n${indentBlock(
      renderMarkdownish(entry.body),
    )}`
  }

  if (entry.kind === 'orchestrator') {
    return `${MAGENTA}${BOLD}orchestrator${RESET} ${DIM}│${RESET} ${indentBlock(renderMarkdownish(entry.body))}`
  }

  if (entry.kind === 'agent_message') {
    return `${CYAN}${BOLD}${entry.agentId}${RESET} ${DIM}│${RESET} ${indentBlock(renderMarkdownish(entry.body))}`
  }

  if (entry.kind === 'agent_board') {
    return renderAgentBoard(entry.agents)
  }

  // Tool entry
  const status =
    entry.status === 'running'
      ? `${YELLOW}running${RESET}`
      : entry.status === 'success'
        ? `${GREEN}ok${RESET}`
        : `${RED}err${RESET}`

  const body =
    entry.status === 'running'
      ? entry.body
      : entry.collapsed
        ? `${DIM}${entry.collapsedSummary ?? 'output collapsed'}${RESET}`
        : entry.collapsePhase
          ? `${DIM}collapsing${'.'.repeat(entry.collapsePhase)}${RESET}`
          : previewToolBody(entry.toolName, renderMarkdownish(entry.body))

  const icon = entry.status === 'success'
    ? `${GREEN}✓${RESET}`
    : entry.status === 'error'
      ? `${RED}✗${RESET}`
      : `${YELLOW}⏳ running${RESET}`
  const durationColor = entry.status === 'error' ? RED : GREEN
  const durationStr = entry.duration !== undefined
    ? ` ${durationColor}${entry.duration}ms${RESET}`
    : ''
  const durationPlain = entry.duration !== undefined
    ? ` ${entry.duration}ms`
    : ''
  const iconPlain = entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '⏳ running'

  const contentLines = body.split('\n')
  const boxInnerWidth = BOX_INNER_WIDTH

  // 顶行
  const headerRight = `${icon}${durationStr}`
  const headerRightPlain = `${iconPlain}${durationPlain}`
  const usedWidth = entry.toolName.length + headerRightPlain.length + 6
  const headerDash = Math.max(1, boxInnerWidth - usedWidth)
  const header = `${DIM}┌─ ${BOLD}${entry.toolName}${RESET}${DIM} ${'─'.repeat(headerDash)} ${headerRight} ${DIM}─┐${RESET}`

  // 内容行
  const rows = contentLines.map(line => {
    let w = displayWidth(line)
    let displayLine = line
    if (w > boxInnerWidth - 3) {
      displayLine = line.slice(0, boxInnerWidth - 6) + '...'
      w = boxInnerWidth - 3
    }
    const pad = Math.max(0, boxInnerWidth - w - 1)
    return `${DIM}│${RESET} ${displayLine}${' '.repeat(pad)}${DIM}│${RESET}`
  })

  // 底行
  const footer = `${DIM}└${'─'.repeat(boxInnerWidth)}┘${RESET}`

  const bar = `${BLUE}│${RESET} `
  return [`${bar}${header}`, ...rows.map(l => `${bar}${l}`), `${bar}${footer}`].join('\n')
}

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

export function renderTranscriptLines(entries: TranscriptEntry[]): string[] {
  const rendered = entries.map(renderTranscriptEntry)
  const separator = `${DIM}${'─'.repeat(40)}${RESET}`
  const logicalLines: string[] = []

  rendered.forEach((block, index) => {
    if (index > 0) {
      logicalLines.push('')
    }

    logicalLines.push(...block.split('\n'))
  })

  const panelWidth = getTranscriptPanelWidth()
  return logicalLines.flatMap(line => wrapPanelBodyLine(line, panelWidth))
}

export function getTranscriptMaxScrollOffset(
  entries: TranscriptEntry[],
  windowSize?: number,
): number {
  if (entries.length === 0) return 0
  const lines = renderTranscriptLines(entries)
  return Math.max(0, lines.length - getTranscriptWindowSize(windowSize))
}

export function renderTranscript(
  entries: TranscriptEntry[],
  scrollOffset: number,
  windowSize?: number,
  selection?: TranscriptSelection,
): string {
  if (entries.length === 0) {
    return ''
  }

  let lines = renderTranscriptLines(entries)
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
): string {
  const lines = renderTranscriptLines(entries)
  const { startLine, startCol, endLine, endCol } = selection

  const result: string[] = []
  for (let i = startLine; i <= endLine && i < lines.length; i++) {
    const plainLine = stripAnsi(lines[i])
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
