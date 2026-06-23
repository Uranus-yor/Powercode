import { charDisplayWidth } from './chrome.js'
import {
  RESET, DIM, BOLD,
  BORDER,
  STATUS_SUCCESS,
  applyGradient,
} from './colors.js'

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '')
}

function stringDisplayWidth(str: string): number {
  const stripped = stripAnsi(str)
  return [...stripped].reduce((sum, ch) => sum + charDisplayWidth(ch), 0)
}

// ═══════════════════════════════════════════════════════════════
// Logo ASCII Art
// ═══════════════════════════════════════════════════════════════

const LOGO_ART: string[] = [
  '██████   ██████  ██     ██ ███████ ██████   ██████  ██████  ██████  ███████',
  '██   ██ ██    ██ ██     ██ ██      ██   ██ ██      ██    ██ ██   ██ ██     ',
  '██████  ██    ██ ██  █  ██ █████   ██████  ██      ██    ██ ██   ██ █████  ',
  '██      ██    ██ ██ ███ ██ ██      ██   ██ ██      ██    ██ ██   ██ ██     ',
  '██       ██████   ███ ███  ███████ ██   ██  ██████  ██████  ██████  ███████',
]

// ═══════════════════════════════════════════════════════════════
// 面板边框
// ═══════════════════════════════════════════════════════════════

const BORDER_CHARS = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
} as const

function borderLine(kind: 'top' | 'bottom', width: number): string {
  const inner = Math.max(0, width - 2)
  if (kind === 'top') {
    return `${BORDER}${BORDER_CHARS.topLeft}${BORDER_CHARS.horizontal.repeat(inner)}${BORDER_CHARS.topRight}${RESET}`
  }
  return `${BORDER}${BORDER_CHARS.bottomLeft}${BORDER_CHARS.horizontal.repeat(inner)}${BORDER_CHARS.bottomRight}${RESET}`
}

function emptyRow(width: number): string {
  return `${BORDER}${BORDER_CHARS.vertical}${RESET}${' '.repeat(Math.max(0, width - 2))}${BORDER}${BORDER_CHARS.vertical}${RESET}`
}

function contentRow(content: string, width: number): string {
  const plain = stripAnsi(content)
  let visible = 0
  for (const ch of plain) visible += charDisplayWidth(ch)
  const inner = width - 3
  if (visible > inner) {
    let truncated = ''
    let w = 0
    for (const ch of plain) {
      const cw = charDisplayWidth(ch)
      if (w + cw > inner) break
      truncated += ch
      w += cw
    }
    return `${BORDER}${BORDER_CHARS.vertical}${RESET} ${truncated}${BORDER}${BORDER_CHARS.vertical}${RESET}`
  }
  const pad = Math.max(0, inner - visible)
  return `${BORDER}${BORDER_CHARS.vertical}${RESET} ${content}${' '.repeat(pad)}${BORDER}${BORDER_CHARS.vertical}${RESET}`
}

// ═══════════════════════════════════════════════════════════════
// 导出渲染函数
// ═══════════════════════════════════════════════════════════════

/**
 * 渲染居中的PowerCode Logo
 */
export function renderCenteredLogo(terminalWidth: number): string {
  const lines: string[] = []
  lines.push('')
  for (const line of LOGO_ART) {
    const textWidth = stripAnsi(line).length
    const padding = Math.max(0, Math.floor((terminalWidth - textWidth) / 2))
    lines.push(' '.repeat(padding) + applyGradient(line))
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * 渲染输入面板
 */
export function renderInputPanel(
  width: number,
  leftPadOrTerminalWidth: number,
  modelName?: string,
  contextPercent?: number,
  input?: string,
  cursorOffset?: number,
): string {
  const leftPad = leftPadOrTerminalWidth
  const pad = ' '.repeat(leftPad)
  const inner = Math.max(0, width - 4)

  // 输入行
  const offset = Math.max(0, Math.min(cursorOffset ?? 0, (input ?? '').length))
  const text = input ?? ''
  let before = text.slice(0, offset)
  const cursor = text[offset] ?? ' '
  let after = text.slice(Math.min(offset + 1, text.length))

  // 截断输入以适应宽度
  const maxInputWidth = Math.max(0, inner - 2)
  const beforeWidth = stringDisplayWidth(before)
  const afterWidth = stringDisplayWidth(after)
  if (beforeWidth + afterWidth > maxInputWidth) {
    if (beforeWidth > maxInputWidth - 1) {
      let w = 0
      let startIdx = 0
      for (let i = 0; i < before.length; i++) {
        const cw = charDisplayWidth(before[i] ?? '')
        if (w + cw > beforeWidth - (maxInputWidth - 1)) {
          startIdx = i
          break
        }
        w += cw
      }
      before = '\u2026' + before.slice(startIdx + 1)
    }
    const remaining = maxInputWidth - stringDisplayWidth(before)
    if (afterWidth > remaining) {
      let w = 0
      let endIdx = after.length
      for (let i = 0; i < after.length; i++) {
        const cw = charDisplayWidth(after[i] ?? '')
        if (w + cw > remaining - 1) {
          endIdx = i
          break
        }
        w += cw
      }
      after = after.slice(0, endIdx) + '\u2026'
    }
  }
  const inputContent = `${STATUS_SUCCESS}${BOLD}>${RESET}${before}${cursor}${after}`

  // 品牌行: PowerCode 左侧，model+ctx 右侧
  const left = applyGradient('PowerCode')
  const model = modelName ? `${DIM}${modelName}${RESET}` : ''
  const ctx = contextPercent !== undefined ? `${contextPercent}%` : '\u2591\u2591\u2591\u2591\u2591\u2591'
  const right = `${model}  ${DIM}ctx${RESET} ${ctx}`
  const rightLen = stringDisplayWidth(right)
  const leftPadCount = Math.max(0, inner - rightLen - stringDisplayWidth(left))
  const brandContent = left + ' '.repeat(leftPadCount) + right

  const rows = [
    pad + borderLine('top', width),
    pad + contentRow(inputContent, width),
    pad + emptyRow(width),
    pad + contentRow(brandContent, width),
    pad + borderLine('bottom', width),
  ]
  return rows.join('\n')
}

/**
 * 渲染会话面板（用于启动界面）
 */
export function renderTranscriptPanel(
  content: string,
  width: number,
  terminalWidth: number,
): string {
  const leftPad = Math.max(0, Math.floor((terminalWidth - width) / 2))
  const pad = ' '.repeat(leftPad)

  const rows = [pad + borderLine('top', width)]
  for (const line of content.split('\n')) {
    rows.push(pad + contentRow(line, width))
  }
  rows.push(pad + borderLine('bottom', width))
  return rows.join('\n')
}
