/**
 * PowerCode TUI - 色条标记设计系统
 *
 * 设计理念：无边框 + 左侧色条 + 语义色彩
 * - 不使用任何边框字符（╭╮╰╯│─）
 * - 使用左侧色条标记不同类型的内容
 * - 使用颜色和符号区分状态
 * - 干净、现代、不会出错
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
// 语义色彩 (Tokyo Night)
// ═══════════════════════════════════════════════════════════════

// 色条颜色（用于标记不同类型）
export const BAR_USER = '\u001b[38;5;111m'     // 蓝色 - 用户消息
export const BAR_TOOL = '\u001b[38;5;114m'     // 绿色 - 工具成功
export const BAR_ERROR = '\u001b[38;5;210m'    // 红色 - 错误
export const BAR_AGENT = '\u001b[38;5;141m'    // 紫色 - Agent
export const BAR_ORCH = '\u001b[38;5;222m'     // 黄色 - 编排器

// 前景层次
export const FG = '\u001b[38;5;251m'           // 正文
export const FG_DIM = '\u001b[38;5;245m'       // 次要
export const FG_BRIGHT = '\u001b[38;5;255m'    // 强调

// 状态色
export const SUCCESS = '\u001b[38;5;114m'      // 绿
export const ERROR = '\u001b[38;5;210m'        // 红
export const WARNING = '\u001b[38;5;222m'      // 黄
export const INFO = '\u001b[38;5;117m'         // 青

// 强调色
export const ACCENT = '\u001b[38;5;111m'       // 蓝
export const ACCENT2 = '\u001b[38;5;141m'      // 紫

// 基础16色
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

// 边框色（仅用于极少数必要场景）
export const BORDER_DIM = '\u001b[38;5;240m'
export const BORDER_ACCENT = '\u001b[38;5;111m'

// 背景色
export const USER_BG = '\u001b[48;5;238m'
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
