import { charDisplayWidth, stringDisplayWidth, renderDivider } from './chrome.js'
import {
  RESET, DIM, BOLD,
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
): string {
  const pad = ' '.repeat(leftPad)
  const result: string[] = []

  // 分隔线
  result.push(`${pad}${renderDivider(width)}`)

  // 输入行: > user input
  const offset = Math.max(0, Math.min(cursorOffset ?? 0, (input ?? '').length))
  const text = input ?? ''
  let before = text.slice(0, offset)
  const cursor = text[offset] ?? ' '
  let after = text.slice(Math.min(offset + 1, text.length))

  // 截断
  const maxInputW = Math.max(0, width - 4)
  const beforeW = stringDisplayWidth(before)
  const afterW = stringDisplayWidth(after)
  if (beforeW + afterW > maxInputW) {
    if (beforeW > maxInputW - 1) {
      let w = 0, si = 0
      for (let i = 0; i < before.length; i++) {
        const cw = charDisplayWidth(before[i] ?? '')
        if (w + cw > beforeW - (maxInputW - 1)) { si = i; break }
        w += cw
      }
      before = '\u2026' + before.slice(si + 1)
    }
    const rem = maxInputW - stringDisplayWidth(before)
    if (afterW > rem) {
      let w = 0, ei = after.length
      for (let i = 0; i < after.length; i++) {
        const cw = charDisplayWidth(after[i] ?? '')
        if (w + cw > rem - 1) { ei = i; break }
        w += cw
      }
      after = after.slice(0, ei) + '\u2026'
    }
  }

  result.push(`${pad}  ${SUCCESS}${BOLD}>${RESET} ${before}${cursor}${after}`)

  // 状态行: model · ctx · 快捷键
  const model = modelName ? `${DIM}model${RESET} ${SUCCESS}${modelName}${RESET}` : ''
  const ctx = contextPercent !== undefined ? `${DIM}ctx${RESET} ${ACCENT}${contextPercent}%${RESET}` : ''
  const statusParts = [model, ctx].filter(Boolean).join(` ${DIM}\u00b7${RESET} `)
  const helpText = `${DIM}Enter${RESET} send ${DIM}\u00b7${RESET} ${DIM}/help${RESET} commands ${DIM}\u00b7${RESET} ${DIM}Esc${RESET} clear ${DIM}\u00b7${RESET} ${DIM}Ctrl+C${RESET} exit`

  if (statusParts) {
    result.push(`${pad}  ${statusParts}  ${DIM}\u2502${RESET}  ${helpText}`)
  } else {
    result.push(`${pad}  ${helpText}`)
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
