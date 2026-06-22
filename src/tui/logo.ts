import { charDisplayWidth } from "./chrome.js"
// PowerCode Logo Module
const DIM = '[2m'
const RESET = '[0m'
const GREEN = '[32m'
const BOLD = '[1m'
const REVERSE = '[7m'

const GRADIENT: string[] = [
  '[38;5;24m', '[38;5;31m', '[38;5;38m',
  '[38;5;45m', '[38;5;51m', '[38;5;87m',
  '[38;5;123m', '[38;5;159m', '[38;5;195m',
]

const LOGO_ART: string[] = [
  '██████   ██████  ██     ██ ███████ ██████   ██████  ██████  ██████  ███████',
  '██   ██ ██    ██ ██     ██ ██      ██   ██ ██      ██    ██ ██   ██ ██     ',
  '██████  ██    ██ ██  █  ██ █████   ██████  ██      ██    ██ ██   ██ █████  ',
  '██      ██    ██ ██ ███ ██ ██      ██   ██ ██      ██    ██ ██   ██ ██     ',
  '██       ██████   ███ ███  ███████ ██   ██  ██████  ██████  ██████  ███████',
]

function stripAnsi(str: string): string {
  return str.replace(/\[[0-9;]*m/g, '')
}

function applyGradient(text: string): string {
  const chars = [...text]
  const result: string[] = []
  const colorCount = GRADIENT.length
  for (let i = 0; i < chars.length; i++) {
    const colorIndex = Math.floor((i / chars.length) * colorCount)
    const color = GRADIENT[Math.min(colorIndex, colorCount - 1)]
    result.push(color + chars[i] + RESET)
  }
  return result.join('')
}

function centerText(text: string, terminalWidth: number): string {
  const textWidth = stripAnsi(text).length
  const padding = Math.max(0, Math.floor((terminalWidth - textWidth) / 2))
  return ' '.repeat(padding) + text
}

// ── Panel primitives (dim/black borders) ──

const BORDER_COLOR = '[2m'  // dim = dark gray/black on most terminals

function borderLine(kind: 'top' | 'bottom', width: number): string {
  const inner = Math.max(0, width - 2)
  if (kind === 'top') return BORDER_COLOR + '╭' + '─'.repeat(inner) + '╮' + RESET
  return BORDER_COLOR + '╰' + '─'.repeat(inner) + '╯' + RESET
}

function emptyRow(width: number): string {
  return BORDER_COLOR + '│' + RESET + ' '.repeat(Math.max(0, width - 2)) + BORDER_COLOR + '│' + RESET
}

function contentRow(content: string, width: number, bg?: string): string {
  // Structure: │(1) + space(1) + content + padding + │(1) = width
  // So padding = width - 3 - visible
  const plain = stripAnsi(content)
  let visible = 0
  for (const ch of plain) visible += charDisplayWidth(ch)
  const pad = Math.max(0, width - 3 - visible)
  const bgOpen = bg ?? ''
  const bgClose = bg ? RESET : ''
  return BORDER_COLOR + '│' + RESET + ' ' + bgOpen + content + ' '.repeat(pad) + bgClose + BORDER_COLOR + '│' + RESET
}

// ── Exported renderers ──

export function renderCenteredLogo(terminalWidth: number): string {
  const lines: string[] = []
  lines.push('')
  for (const line of LOGO_ART) {
    lines.push(centerText(applyGradient(line), terminalWidth))
  }
  lines.push('')
  return lines.join('\n')
}

export function renderInputPanel(
  width: number,
  leftPadOrTerminalWidth: number,
  modelName?: string,
  contextPercent?: number,
  input?: string,
  cursorOffset?: number,
): string {
  // Support both direct leftPad (working state) and terminalWidth (startup)
  const leftPad = leftPadOrTerminalWidth
  const pad = ' '.repeat(leftPad)
  const inner = Math.max(0, width - 4)

  // Input row
  const offset = Math.max(0, Math.min(cursorOffset ?? 0, (input ?? '').length))
  const text = input ?? ''
  const before = text.slice(0, offset)
  const cursor = text[offset] ?? ' '
  const after = text.slice(Math.min(offset + 1, text.length))
  const inputContent = GREEN + BOLD + '>' + RESET + before + cursor + after

  // Brand row: PowerCode left, model+ctx right
  const left = applyGradient('PowerCode')
  const model = modelName ? DIM + modelName + RESET : ''
  const ctx = contextPercent !== undefined ? contextPercent + '%' : '░░░░░░'
  const right = model + '  ' + DIM + 'ctx' + RESET + ' ' + ctx
  const rightLen = stripAnsi(right).length
  const leftPadCount = Math.max(0, inner - rightLen - stripAnsi(left).length)
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
