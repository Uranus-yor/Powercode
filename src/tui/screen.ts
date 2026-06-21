import process from 'node:process'

const ENTER_ALT_SCREEN = '[?1049h'
const EXIT_ALT_SCREEN = '[?1049l'
const ERASE_SCREEN_AND_HOME = '[2J[H'
const ENABLE_MOUSE_TRACKING =
  '[?1000h' +
  '[?1002h' +
  '[?1006h'
const DISABLE_MOUSE_TRACKING =
  '[?1006l' +
  '[?1002l' +
  '[?1000l'
export function hideCursor(): void {
  process.stdout.write('[?25l')
}

export function showCursor(): void {
  process.stdout.write('[?25h')
}

export function enterAlternateScreen(): void {
  lastFrameLineCount = 0
  process.stdout.write(
    DISABLE_MOUSE_TRACKING + ENTER_ALT_SCREEN + ERASE_SCREEN_AND_HOME + ENABLE_MOUSE_TRACKING,
  )
}

export function exitAlternateScreen(): void {
  process.stdout.write(DISABLE_MOUSE_TRACKING + EXIT_ALT_SCREEN)
}

let lastFrameLineCount = 0

export function clearScreen(): void {
  // Move cursor to home, then overwrite. Only erase leftover lines if the
  // new frame is shorter than the previous one.  This avoids the full-screen
  // flash that \x1b[J causes on Windows terminals.
  process.stdout.write('[H')
}

export function finalizeFrame(lineCount: number): void {
  // If the new frame has fewer lines than the last one, erase the leftover
  // lines so stale content doesn't remain visible.
  if (lineCount < lastFrameLineCount) {
    const eraseCount = lastFrameLineCount - lineCount
    for (let i = 0; i < eraseCount; i++) {
      process.stdout.write('[2K\n')
    }
    // Move cursor back up to the end of the new frame.
    process.stdout.write(`[${eraseCount}A`)
  }
  lastFrameLineCount = lineCount
}

export function moveCursorTo(row: number, col: number): void {
  // ANSI: move cursor to row;col (1-indexed)
  process.stdout.write(`[${row};${col}H`)
}

export function enableCursorBlink(): void {
  // CSI ? 12 h = enable cursor blinking
  process.stdout.write('[?12h')
}

export function forceFullRepaint(): void {
  // Full erase + home + reset frame counter. Use after terminal resize.
  process.stdout.write("[2J[H")
  lastFrameLineCount = 0
}
