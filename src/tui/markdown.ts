import {
  RESET, DIM, BOLD, ITALIC, UNDERLINE,
  SUCCESS,
  CYAN, GREEN, YELLOW, BLUE, MAGENTA,
  FG_DIM,
} from './colors.js'

// ═══════════════════════════════════════════════════════════════
// 代码语法高亮
// ═══════════════════════════════════════════════════════════════

function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase()
  if (!['typescript', 'javascript', 'ts', 'js', 'jsx', 'tsx'].includes(lang)) {
    return `${DIM}${code}${RESET}`
  }
  let result = code
  // 注释
  result = result.replace(/(\/\/.*$)/gm, `${DIM}$1${RESET}`)
  // 字符串
  result = result.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, `${GREEN}$1${RESET}`)
  // 数字
  result = result.replace(/\b(\d+)\b/g, `${YELLOW}$1${RESET}`)
  // 类型
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
// 行内元素解析（递归处理嵌套格式）
// ═══════════════════════════════════════════════════════════════

function renderInline(text: string): string {
  // 1. 先处理代码（最高优先级，不处理内部格式）
  const codeParts: string[] = []
  let codeIdx = 0
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `\x00CODE${codeIdx}\x00`
    codeParts.push(`${MAGENTA}${code}${RESET}`)
    codeIdx++
    return placeholder
  })

  // 2. 处理链接 [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${CYAN}$1${RESET} ${DIM}($2)${RESET}`)

  // 3. 处理加粗 **text**（支持嵌套）
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)

  // 4. 处理斜体 *text*（支持嵌套）
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, `${ITALIC}$1${RESET}`)

  // 5. 处理删除线 ~~text~~
  text = text.replace(/~~(.+?)~~/g, `${DIM}$1${RESET}`)

  // 6. 处理下划线 __text__
  text = text.replace(/__(.+?)__/g, `${UNDERLINE}$1${RESET}`)

  // 7. 恢复代码占位符
  text = text.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeParts[parseInt(idx)] ?? '')

  return text
}

// ═══════════════════════════════════════════════════════════════
// 块级元素解析（按行处理）
// ═══════════════════════════════════════════════════════════════

export function renderMarkdownish(input: string): string {
  const lines = input.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let currentLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    // ── 代码块 ──
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // 结束代码块
        inCodeBlock = false
        currentLang = ''
        result.push(`${DIM}${'─'.repeat(40)}${RESET}`)
      } else {
        // 开始代码块
        inCodeBlock = true
        currentLang = line.slice(3).trim()
        if (currentLang) {
          result.push(`${DIM}── ${currentLang} ${'─'.repeat(Math.max(0, 36 - currentLang.length))}${RESET}`)
        } else {
          result.push(`${DIM}${'─'.repeat(40)}${RESET}`)
        }
      }
      continue
    }

    if (inCodeBlock) {
      result.push(currentLang ? highlightCode(line, currentLang) : `${DIM}${line}${RESET}`)
      continue
    }

    // ── 分隔线 ──
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line.trim())) {
      result.push(`${DIM}${'─'.repeat(40)}${RESET}`)
      continue
    }

    // ── 表格 ──
    if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim())) {
      // 表格分隔行
      result.push(`${DIM}${line.replace(/\|/g, '─').trim()}${RESET}`)
      continue
    }
    if (/^\|.*\|$/.test(line.trim())) {
      // 表格内容行
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      result.push(cells.join(` ${DIM}│${RESET} `))
      continue
    }

    // ── 标题 ──
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1]!.length
      const text = headingMatch[2]!
      const prefix = '#'.repeat(level)
      if (level <= 2) {
        result.push(`${CYAN}${BOLD}${text}${RESET}`)
        result.push(`${DIM}${'─'.repeat(Math.min(40, text.length * 2))}${RESET}`)
      } else {
        result.push(`${CYAN}${BOLD}${text}${RESET}`)
      }
      continue
    }

    // ── 引用 ──
    if (line.startsWith('> ')) {
      const quoteContent = line.slice(2)
      result.push(`${DIM}│${RESET} ${DIM}${renderInline(quoteContent)}${RESET}`)
      continue
    }

    // ── 任务列表 ──
    const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/)
    if (taskMatch) {
      const indent = taskMatch[1] ?? ''
      const state = taskMatch[2]
      const content = taskMatch[3]!
      const icon = state === ' ' ? `${DIM}☐${RESET}` : `${SUCCESS}☑${RESET}`
      result.push(`${indent}${icon} ${renderInline(content)}`)
      continue
    }

    // ── 无序列表 ──
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/)
    if (ulMatch) {
      const indent = ulMatch[1] ?? ''
      const content = ulMatch[2]!
      const level = Math.floor(indent.length / 2)
      const markers = ['•', '◦', '▪']
      const marker = markers[Math.min(level, 2)]
      result.push(`${indent}${YELLOW}${marker}${RESET} ${renderInline(content)}`)
      continue
    }

    // ── 有序列表 ──
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/)
    if (olMatch) {
      const indent = olMatch[1] ?? ''
      const num = olMatch[2]!
      const content = olMatch[3]!
      result.push(`${indent}${YELLOW}${num}.${RESET} ${renderInline(content)}`)
      continue
    }

    // ── 普通段落 ──
    result.push(renderInline(line))
  }

  return result.join('\n')
}
