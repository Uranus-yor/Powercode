import {
  RESET, DIM, BOLD,
  STATUS_SUCCESS,
  CYAN, GREEN, YELLOW, BLUE, MAGENTA,
} from './colors.js'

// ═══════════════════════════════════════════════════════════════
// 代码高亮
// ═══════════════════════════════════════════════════════════════

function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase()
  if (lang !== 'typescript' && lang !== 'javascript' && lang !== 'ts' && lang !== 'js') {
    return `${DIM}${code}${RESET}`
  }

  let result = code

  // 注释
  result = result.replace(/(\/\/.*$)/gm, `${DIM}$1${RESET}`)
  // 字符串
  result = result.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, `${GREEN}$1${RESET}`)
  // 数字
  result = result.replace(/\b(\d+)\b/g, `${YELLOW}$1${RESET}`)
  // 类型（在关键字之前匹配，避免被关键字覆盖）
  result = result.replace(
    /\b(string|number|boolean|any|void|never|object|Array|Promise|Map|Set|Record|Partial|Required|Readonly)\b/g,
    `${CYAN}$1${RESET}`,
  )
  // 关键字
  result = result.replace(
    /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|default|continue|class|extends|implements|interface|type|enum|import|export|from|as|async|await|new|this|try|catch|throw|finally|typeof|instanceof|in|of|yield|static|get|set|super|abstract|declare|namespace|module|readonly|private|protected|public|override)\b/g,
    `${BLUE}$1${RESET}`,
  )

  return result
}

// ═══════════════════════════════════════════════════════════════
// Markdown 渲染
// ═══════════════════════════════════════════════════════════════

export function renderMarkdownish(input: string): string {
  const lines = input.split('\n')
  let inCodeBlock = false
  let currentCodeBlockLang = ''

  return lines
    .map(line => {
      let formatted = line

      // 代码块
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        const lang = line.slice(3).trim()
        if (inCodeBlock) {
          currentCodeBlockLang = lang
          return lang
            ? `${DIM}\u2500\u2500 ${lang} \u2500\u2500${RESET}`
            : `${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`
        }
        currentCodeBlockLang = ''
        return `${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`
      }

      if (inCodeBlock) {
        const lang = currentCodeBlockLang
        return lang ? highlightCode(line, lang) : `${DIM}${line}${RESET}`
      }

      // 分隔线
      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line.trim())) {
        return `${DIM}${'\u2500'.repeat(40)}${RESET}`
      }

      // 表格分隔行
      if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim())) {
        return `${DIM}${line.replace(/\|/g, ' ').trim()}${RESET}`
      }

      // 表格行
      if (/^\|.*\|$/.test(line.trim())) {
        const cells = line
          .split('|')
          .map(cell => cell.trim())
          .filter(Boolean)
        return cells.join(` ${DIM}|${RESET} `)
      }

      // 标题
      if (line.startsWith('### ')) {
        return `${CYAN}${BOLD}${line.slice(4)}${RESET}`
      }

      if (line.startsWith('## ')) {
        return `${CYAN}${BOLD}${line.slice(3)}${RESET}`
      }

      if (line.startsWith('# ')) {
        return `${CYAN}${BOLD}${line.slice(2)}${RESET}`
      }

      // 引用
      if (line.startsWith('> ')) {
        return `${DIM}${line}${RESET}`
      }

      // 列表
      if (/^\s*\d+\.\s+/.test(line)) {
        formatted = line.replace(/^(\s*)(\d+\.)(\s+)/, `$1${YELLOW}$2${RESET}$3`)
      } else if (/^\s*[-*]\s+\[([ xX])\]\s+/.test(line)) {
        formatted = line.replace(
          /^(\s*)[-*]\s+\[([ xX])\]\s+/,
          (_match, indent, state) => {
            const icon = state === ' ' ? `${DIM}\u2610${RESET}` : `${STATUS_SUCCESS}\u2611${RESET}`
            return `${indent}${icon} `
          },
        )
      } else if (/^\s*[-*]\s+/.test(line)) {
        const indent = line.match(/^(\s*)/)?.[1] ?? ''
        const level = Math.floor(indent.length / 2)
        const markers = ['\u2022', '\u25E6', '\u25AA']
        const marker = markers[Math.min(level, markers.length - 1)]
        formatted = line.replace(/^\s*[-*]\s+/, `${indent}${YELLOW}${marker}${RESET} `)
      }

      // 内联格式
      formatted = formatted.replace(/`([^`]+)`/g, `${MAGENTA}$1${RESET}`)
      formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${CYAN}$1${RESET} ${DIM}($2)${RESET}`)
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)

      return formatted
    })
    .join('\n')
}
