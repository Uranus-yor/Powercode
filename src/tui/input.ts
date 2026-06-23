import {
  RESET, DIM, BOLD, REVERSE,
  SUCCESS, WARNING,
} from './colors.js'

export function renderInputPrompt(input: string, cursorOffset: number): string {
  const offset = Math.max(0, Math.min(cursorOffset, input.length))
  const before = input.slice(0, offset)
  const current = input[offset] ?? ' '
  const after = input.slice(Math.min(offset + 1, input.length))
  return [
    `${WARNING}${BOLD}prompt${RESET} ${DIM}Enter send | /help commands | Esc clear | Ctrl+C exit${RESET}`,
    '',
    `${SUCCESS}${BOLD}>${RESET} ${before}${REVERSE}${current}${RESET}${after}${DIM}${input ? '' : ' Ask for code, files, tasks, or MCP tools'}${RESET}`,
  ].join('\n')
}
