/**
 * PowerCode TUI Design System
 *
 * 设计理念：无外框 + 独立卡片 + 语义色彩
 * - 主区域不使用外框，内容直接展示
 * - 工具/Agent 使用独立卡片，边框完整闭合
 * - 用户消息使用左侧色条强调
 * - 状态信息使用顶部/底部横幅
 */

// ═══════════════════════════════════════════════════════════════
// 基础样式
// ═══════════════════════════════════════════════════════════════

export const RESET = '\u001b[0m'
export const BOLD = '\u001b[1m'
export const DIM = '\u001b[2m'
export const ITALIC = '\u001b[3m'
export const UNDERLINE = '\u001b[4m'
export const REVERSE = '\u001b[7m'

// ═══════════════════════════════════════════════════════════════
// 语义色彩 (Tokyo Night 主题)
// ═══════════════════════════════════════════════════════════════

// 背景层次 (从深到浅)
export const BG_BASE = '\u001b[48;5;234m'      // #1a1b26 最深
export const BG_SURFACE = '\u001b[48;5;236m'   // #24283b 面板
export const BG_HIGHLIGHT = '\u001b[48;5;238m' // #2f3347 高亮行

// 前景层次
export const FG = '\u001b[38;5;251m'           // #c0caf5 正文
export const FG_DIM = '\u001b[38;5;245m'       // #565f89 次要
export const FG_BRIGHT = '\u001b[38;5;255m'    // #ffffff 强调
export const FG_DARK = '\u001b[38;5;236m'      // 深色文字 (用于浅背景)

// 状态色
export const SUCCESS = '\u001b[38;5;114m'      // #9ece6a 绿
export const ERROR = '\u001b[38;5;210m'        // #f7768e 红
export const WARNING = '\u001b[38;5;222m'      // #e0af68 黄
export const INFO = '\u001b[38;5;117m'         // #7dcfff 青

// 强调色
export const ACCENT = '\u001b[38;5;111m'       // #7aa2f7 蓝 (主品牌色)
export const ACCENT2 = '\u001b[38;5;141m'      // #bb9af7 紫

// 基础16色 (兼容)
export const CYAN = '\u001b[36m'
export const GREEN = '\u001b[32m'
export const YELLOW = '\u001b[33m'
export const RED = '\u001b[31m'
export const BLUE = '\u001b[34m'
export const MAGENTA = '\u001b[35m'
export const BRIGHT_CYAN = '\u001b[96m'
export const BRIGHT_GREEN = '\u001b[92m'
export const BRIGHT_RED = '\u001b[91m'
export const BRIGHT_YELLOW = '\u001b[93m'

// 边框色
export const BORDER_DIM = '\u001b[38;5;240m'   // 暗灰边框
export const BORDER_ACCENT = '\u001b[38;5;111m' // 蓝色边框 (聚焦)

// 用户消息背景
export const USER_BG = '\u001b[48;5;238m'      // 用户消息背景
export const BLACK = '\u001b[30m'

// 渐变色
export const GRADIENT: string[] = [
  '\u001b[38;5;24m', '\u001b[38;5;31m', '\u001b[38;5;38m',
  '\u001b[38;5;45m', '\u001b[38;5;51m', '\u001b[38;5;87m',
  '\u001b[38;5;123m', '\u001b[38;5;159m', '\u001b[38;5;195m',
]

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

export function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '')
}

export function applyGradient(text: string): string {
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

export function colorBadge(label: string, value: string, color: string): string {
  return `${color}${label}${RESET} ${BOLD}${value}${RESET}`
}
