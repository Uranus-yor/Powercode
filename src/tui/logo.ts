import { charDisplayWidth, stringDisplayWidth, renderDivider } from './chrome.js'
import {
  RESET, DIM, BOLD, REVERSE,
  SUCCESS, ACCENT,
  FG_DIM,
  applyGradient, stripAnsi,
} from './colors.js'

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
// 渲染居中Logo
// ═══════════════════════════════════════════════════════════════

export function renderCenteredLogo(terminalWidth: number): string {
  const lines: string[] = []
  lines.push('')
  for (const line of LOGO_ART) {
    const w = stripAnsi(line).length
    const pad = Math.max(0, Math.floor((terminalWidth - w) / 2))
    lines.push(' '.repeat(pad) + applyGradient(line))
  }
  lines.push('')
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 渲染输入面板 - 无边框设计
// ═══════════════════════════════════════════════════════════════

export function renderInputPanel(
  width: number,
  leftPad: number,
  modelName?: string,
  contextPercent?: number,
  input?: string,
  cursorOffset?: number,
  cursorVisible?: boolean,
): string {
  const pad = ' '.repeat(leftPad)
  const result: string[] = []

  // 分隔线
  result.push(`${pad}${renderDivider(width)}`)

  // 输入内容：支持多行显示
  const text = input ?? ''
  const offset = Math.max(0, Math.min(cursorOffset ?? 0, text.length))
  const maxInputW = Math.max(0, width - 6)  // "> " 前缀 + 两侧 padding

  // 将输入文本按宽度换行
  const lines: string[] = []
  let currentLine = ''
  let currentWidth = 0
  let cursorLine = 0
  let cursorColInLine = 0
  let charIndex = 0

  for (const ch of [...text]) {
    const cw = charDisplayWidth(ch)
    if (currentWidth + cw > maxInputW && currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = ''
      currentWidth = 0
    }
    if (charIndex === offset) {
      cursorLine = lines.length
      cursorColInLine = currentWidth
    }
    currentLine += ch
    currentWidth += cw
    charIndex++
  }
  lines.push(currentLine)

  // 如果光标在最后
  if (charIndex === offset) {
    cursorLine = lines.length - 1
    cursorColInLine = currentWidth
  }

  // 如果没有输入，显示一行空的带光标
  if (lines.length === 0) {
    lines.push('')
  }

  // 渲染每一行
  const showCursor = cursorVisible !== false  // 默认显示光标
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (i === cursorLine) {
      // 光标所在行
      const before = line.slice(0, Math.min(offset, line.length))
      const cursorCh = line[offset] ?? ' '
      const after = line.slice(Math.min(offset + 1, line.length))
      // > 用暗灰色，光标用反色
      if (showCursor) {
        result.push(`${pad}  ${DIM}>${RESET} ${before}${REVERSE}${cursorCh}${RESET}${after}`)
      } else {
        result.push(`${pad}  ${DIM}>${RESET} ${before} ${after}`)
      }
    } else if (i === 0) {
      // 第一行
      result.push(`${pad}  ${DIM}>${RESET} ${line}`)
    } else {
      // 后续行（续行）
      result.push(`${pad}    ${line}`)
    }
  }

  // 状态行: model · ctx · 快捷键
  const model = modelName ? `${DIM}model${RESET} ${SUCCESS}${modelName}${RESET}` : ''
  const ctx = contextPercent !== undefined ? `${DIM}ctx${RESET} ${ACCENT}${contextPercent}%${RESET}` : ''
  const statusParts = [model, ctx].filter(Boolean).join(` ${DIM}\u00b7${RESET} `)
  const helpText = `${DIM}Enter${RESET} send ${DIM}\u00b7${RESET} ${DIM}/help${RESET} commands ${DIM}\u00b7${RESET} ${DIM}Esc${RESET} clear ${DIM}\u00b7${RESET} ${DIM}Ctrl+C${RESET} exit`

  if (statusParts) {
    result.push(`${pad}${statusParts}  ${DIM}\u2502${RESET}  ${helpText}`)
  } else {
    result.push(`${pad}${helpText}`)
  }

  return result.join('\n')
}

/**
 * 渲染会话面板（用于 session picker）
 */
export function renderTranscriptPanel(content: string, width: number, terminalWidth: number): string {
  const leftPad = Math.max(0, Math.floor((terminalWidth - width) / 2))
  const pad = ' '.repeat(leftPad)
  const result: string[] = []
  result.push(`${pad}${renderDivider(width)}`)
  for (const line of content.split('\n')) {
    result.push(`${pad}  ${line}`)
  }
  return result.join('\n')
}
