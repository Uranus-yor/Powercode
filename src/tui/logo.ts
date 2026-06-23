import { charDisplayWidth, stringDisplayWidth } from './chrome.js'
import {
  RESET, DIM, BOLD,
  BORDER_DIM, BORDER_ACCENT,
  SUCCESS, ACCENT,
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
// 渲染输入面板 - 简洁现代设计
// ═══════════════════════════════════════════════════════════════

const B = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│',
} as const

export function renderInputPanel(
  width: number,
  leftPad: number,
  modelName?: string,
  contextPercent?: number,
  input?: string,
  cursorOffset?: number,
): string {
  const pad = ' '.repeat(leftPad)
  const inner = Math.max(0, width - 2)
  const result: string[] = []

  // 顶部边框
  const titlePart = ` ${BOLD}${applyGradient('PowerCode')}${RESET}${BORDER_DIM} `
  const titleW = stringDisplayWidth('PowerCode') + 4

  // 右侧: model + ctx
  const model = modelName ? `${DIM}model${RESET} ${SUCCESS}${modelName}${RESET}` : ''
  const ctx = contextPercent !== undefined ? `${DIM}ctx${RESET} ${ACCENT}${contextPercent}%${RESET}` : ''
  const rightInfo = [model, ctx].filter(Boolean).join(` ${DIM}\u2022${RESET} `)
  const rightW = stringDisplayWidth(rightInfo) + 2

  const dashN = Math.max(1, inner - 1 - titleW - rightW)
  result.push(`${pad}${BORDER_DIM}${B.tl}${B.h}${RESET}${titlePart}${BORDER_DIM}${B.h.repeat(dashN)} ${rightInfo} ${B.tr}${RESET}`)

  // 输入行
  const offset = Math.max(0, Math.min(cursorOffset ?? 0, (input ?? '').length))
  const text = input ?? ''
  let before = text.slice(0, offset)
  const cursor = text[offset] ?? ' '
  let after = text.slice(Math.min(offset + 1, text.length))

  // 截断
  const maxInputW = Math.max(0, inner - 6)
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

  const inputContent = `${SUCCESS}${BOLD}>${RESET} ${before}${cursor}${after}`
  result.push(`${pad}${BORDER_DIM}${B.v}${RESET} ${inputContent}${' '.repeat(Math.max(0, inner - 1 - stringDisplayWidth(inputContent) - 1))}${BORDER_DIM}${B.v}${RESET}`)

  // 底部边框
  result.push(`${pad}${BORDER_DIM}${B.bl}${B.h.repeat(inner)}${B.br}${RESET}`)

  // 快捷键提示
  result.push(`${pad}  ${DIM}Enter${RESET} send ${DIM}\u2022${RESET} ${DIM}/help${RESET} commands ${DIM}\u2022${RESET} ${DIM}Esc${RESET} clear ${DIM}\u2022${RESET} ${DIM}Ctrl+C${RESET} exit`)

  return result.join('\n')
}

/**
 * 渲染会话面板（用于 session picker 等）
 */
export function renderTranscriptPanel(content: string, width: number, terminalWidth: number): string {
  const leftPad = Math.max(0, Math.floor((terminalWidth - width) / 2))
  const pad = ' '.repeat(leftPad)
  const inner = width - 2

  const result: string[] = []
  result.push(`${pad}${BORDER_DIM}${B.tl}${B.h.repeat(inner)}${B.tr}${RESET}`)
  for (const line of content.split('\n')) {
    const w = stringDisplayWidth(line)
    const p = Math.max(0, inner - w)
    result.push(`${pad}${BORDER_DIM}${B.v}${RESET} ${line}${' '.repeat(p)}${BORDER_DIM}${B.v}${RESET}`)
  }
  result.push(`${pad}${BORDER_DIM}${B.bl}${B.h.repeat(inner)}${B.br}${RESET}`)
  return result.join('\n')
}
