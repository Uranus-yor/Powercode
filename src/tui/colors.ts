/**
 * TUI 语义化颜色系统
 * 
 * 设计原则:
 * 1. 语义化命名 - 颜色按用途命名，不是按外观
 * 2. 统一定义 - 所有颜色从这里导入
 * 3. 主题支持 - 便于未来切换主题
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
export const STRIKETHROUGH = '\u001b[9m'

// ═══════════════════════════════════════════════════════════════
// 背景色 (Background)
// ═══════════════════════════════════════════════════════════════

/** 最深背景 - 主背景 */
export const BG_BASE = '\u001b[48;5;234m'      // #1a1b26
/** 面板/卡片背景 */
export const BG_SURFACE = '\u001b[48;5;236m'   // #24283b
/** 弹窗/浮层背景 */
export const BG_OVERLAY = '\u001b[48;5;240m'   // #414868
/** 选中项背景 */
export const BG_SELECTION = '\u001b[48;5;24m'  // #364a82
/** 用户消息背景 */
export const BG_USER = '\u001b[48;5;254m'      // 浅灰色

// ═══════════════════════════════════════════════════════════════
// 前景色 (Foreground)
// ═══════════════════════════════════════════════════════════════

/** 默认正文颜色 */
export const FG_DEFAULT = '\u001b[38;5;251m'   // #c0caf5
/** 次要文字/元数据 */
export const FG_MUTED = '\u001b[38;5;245m'     // #565f89
/** 强调文字/标题 */
export const FG_EMPHASIS = '\u001b[38;5;255m'  // #e0e0e0
/** 深色文字 (用于浅色背景) */
export const FG_DARK = '\u001b[30m'

// ═══════════════════════════════════════════════════════════════
// 状态色 (Status Colors)
// ═══════════════════════════════════════════════════════════════

/** 成功/完成/添加 - 绿色 */
export const STATUS_SUCCESS = '\u001b[38;5;114m'  // #9ece6a
/** 错误/失败/删除 - 红色 */
export const STATUS_ERROR = '\u001b[38;5;210m'    // #f7768e
/** 警告/注意 - 黄色 */
export const STATUS_WARNING = '\u001b[38;5;222m'  // #e0af68
/** 信息/提示 - 青色 */
export const STATUS_INFO = '\u001b[38;5;117m'     // #7dcfff
/** 运行中/处理中 - 黄色 */
export const STATUS_RUNNING = '\u001b[38;5;222m'  // #e0af68

// ═══════════════════════════════════════════════════════════════
// 强调色 (Accent Colors)
// ═══════════════════════════════════════════════════════════════

/** 主强调色 - 品牌色/交互元素 */
export const ACCENT_PRIMARY = '\u001b[38;5;111m'   // #7aa2f7
/** 次强调色 - 辅助交互 */
export const ACCENT_SECONDARY = '\u001b[38;5;141m' // #bb9af7

// ═══════════════════════════════════════════════════════════════
// 基础16色 (兼容性)
// ═══════════════════════════════════════════════════════════════

export const BLACK = '\u001b[30m'
export const RED = '\u001b[31m'
export const GREEN = '\u001b[32m'
export const YELLOW = '\u001b[33m'
export const BLUE = '\u001b[34m'
export const MAGENTA = '\u001b[35m'
export const CYAN = '\u001b[36m'
export const WHITE = '\u001b[37m'

export const BRIGHT_RED = '\u001b[91m'
export const BRIGHT_GREEN = '\u001b[92m'
export const BRIGHT_YELLOW = '\u001b[93m'
export const BRIGHT_BLUE = '\u001b[94m'
export const BRIGHT_MAGENTA = '\u001b[95m'
export const BRIGHT_CYAN = '\u001b[96m'
export const BRIGHT_WHITE = '\u001b[97m'

// ═══════════════════════════════════════════════════════════════
// 边框专用色
// ═══════════════════════════════════════════════════════════════

/** 边框颜色 - 暗灰色 */
export const BORDER = '\u001b[2m'
/** 边框高亮色 - 聚焦时 */
export const BORDER_FOCUS = '\u001b[38;5;111m' // 同 ACCENT_PRIMARY

// ═══════════════════════════════════════════════════════════════
// 渐变色 (用于Logo等)
// ═══════════════════════════════════════════════════════════════

export const GRADIENT: string[] = [
  '\u001b[38;5;24m',   // 深蓝
  '\u001b[38;5;31m',   // 蓝
  '\u001b[38;5;38m',   // 浅蓝
  '\u001b[38;5;45m',   // 天蓝
  '\u001b[38;5;51m',   // 青
  '\u001b[38;5;87m',   // 亮青
  '\u001b[38;5;123m',  // 浅青
  '\u001b[38;5;159m',  // 极浅蓝
  '\u001b[38;5;195m',  // 白蓝
]

// ═══════════════════════════════════════════════════════════════
// 语义化组合 (常用组合)
// ═══════════════════════════════════════════════════════════════

/** 成功状态: 绿色 + 粗体 */
export const SUCCESS_STYLE = `${BOLD}${STATUS_SUCCESS}`
/** 错误状态: 红色 + 粗体 */
export const ERROR_STYLE = `${BOLD}${STATUS_ERROR}`
/** 警告状态: 黄色 + 粗体 */
export const WARNING_STYLE = `${BOLD}${STATUS_WARNING}`
/** 信息状态: 青色 */
export const INFO_STYLE = `${STATUS_INFO}`
/** 标题样式: 强调色 + 粗体 */
export const HEADING_STYLE = `${BOLD}${FG_EMPHASIS}`
/** 次要文字: 暗淡 */
export const MUTED_STYLE = `${DIM}${FG_MUTED}`

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 移除所有ANSI转义序列 */
export function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '')
}

/** 应用渐变色到文本 */
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

/** 创建彩色徽章 [label] value */
export function colorBadge(label: string, value: string, color: string): string {
  return `${color}[${label}]${RESET} ${BOLD}${value}${RESET}`
}
