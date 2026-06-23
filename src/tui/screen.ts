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

// ========== 双缓冲渲染 ==========

let previousFrame: string[] = []

/**
 * 双缓冲渲染：只更新变化的行，消除闪烁
 * 对比上一帧，只写入变化的行
 */
export function renderFrame(lines: string[]): void {
  const maxLines = Math.max(previousFrame.length, lines.length)

  // 隐藏光标避免闪烁
  process.stdout.write('\x1b[?25l')

  for (let i = 0; i < maxLines; i++) {
    const oldLine = previousFrame[i] ?? ''
    const newLine = lines[i] ?? ''

    if (oldLine === newLine) {
      continue  // 跳过未变化的行
    }

    // 移动光标到第 i+1 行，写入新内容
    process.stdout.write(`\x1b[${i + 1};1H`)
    process.stdout.write('\x1b[2K')  // 清除整行
    process.stdout.write(newLine)
  }

  // 如果新帧更短，清除多余行
  for (let i = lines.length; i < previousFrame.length; i++) {
    process.stdout.write(`\x1b[${i + 1};1H`)
    process.stdout.write('\x1b[2K')
  }

  previousFrame = [...lines]
  lastFrameLineCount = lines.length
}

/**
 * 重置缓冲区并清除屏幕（用于全屏重绘，如终端大小变化后）
 */
export function resetBuffer(): void {
  // 清除整个屏幕并移动光标到左上角
  process.stdout.write('\x1b[2J\x1b[H')
  previousFrame = []
  lastFrameLineCount = 0
}
