import {
  RESET, DIM, BOLD,
  SUCCESS,
  CYAN, GREEN, YELLOW, BLUE, MAGENTA,
} from './colors.js'

function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase()
  if (lang !== 'typescript' && lang !== 'javascript' && lang !== 'ts' && lang !== 'js') {
    return `${DIM}${code}${RESET}`
  }
  let result = code
  result = result.replace(/(\/\/.*$)/gm, `${DIM}$1${RESET}`)
  result = result.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, `${GREEN}$1${RESET}`)
  result = result.replace(/\b(\d+)\b/g, `${YELLOW}$1${RESET}`)
  result = result.replace(
    /\b(string|number|boolean|any|void|never|object|Array|Promise|Map|Set|Record|Partial|Required|Readonly)\b/g,
    `${CYAN}$1${RESET}`,
  )
  result = result.replace(
    /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|default|continue|class|extends|implements|interface|type|enum|import|export|from|as|async|await|new|this|try|catch|throw|finally|typeof|instanceof|in|of|yield|static|get|set|super|abstract|declare|namespace|module|readonly|private|protected|public|override)\b/g,
    `${BLUE}$1${RESET}`,
  )
  return result
}

export function renderMarkdownish(input: string): string {
  const lines = input.split('\n')
  let inCodeBlock = false
  let currentLang = ''

  return lines.map(line => {
    let f = line

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      const lang = line.slice(3).trim()
      if (inCodeBlock) {
        currentLang = lang
        return lang ? `${DIM}\u2500\u2500 ${lang} \u2500\u2500${RESET}` : `${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`
      }
      currentLang = ''
      return `${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`
    }

    if (inCodeBlock) return currentLang ? highlightCode(line, currentLang) : `${DIM}${line}${RESET}`

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line.trim())) return `${DIM}${'\u2500'.repeat(40)}${RESET}`
    if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim())) return `${DIM}${line.replace(/\|/g, ' ').trim()}${RESET}`
    if (/^\|.*\|$/.test(line.trim())) {
      return line.split('|').map(c => c.trim()).filter(Boolean).join(` ${DIM}|${RESET} `)
    }

    if (line.startsWith('### ')) return `${CYAN}${BOLD}${line.slice(4)}${RESET}`
    if (line.startsWith('## ')) return `${CYAN}${BOLD}${line.slice(3)}${RESET}`
    if (line.startsWith('# ')) return `${CYAN}${BOLD}${line.slice(2)}${RESET}`
    if (line.startsWith('> ')) return `${DIM}${line}${RESET}`

    if (/^\s*\d+\.\s+/.test(line)) {
      f = line.replace(/^(\s*)(\d+\.)(\s+)/, `$1${YELLOW}$2${RESET}$3`)
    } else if (/^\s*[-*]\s+\[([ xX])\]\s+/.test(line)) {
      f = line.replace(/^(\s*)[-*]\s+\[([ xX])\]\s+/, (_m, ind, st) => {
        const icon = st === ' ' ? `${DIM}\u2610${RESET}` : `${SUCCESS}\u2611${RESET}`
        return `${ind}${icon} `
      })
    } else if (/^\s*[-*]\s+/.test(line)) {
      const ind = line.match(/^(\s*)/)?.[1] ?? ''
      const level = Math.floor(ind.length / 2)
      const markers = ['\u2022', '\u25e6', '\u25aa']
      f = line.replace(/^\s*[-*]\s+/, `${ind}${YELLOW}${markers[Math.min(level, 2)]}${RESET} `)
    }

    f = f.replace(/`([^`]+)`/g, `${MAGENTA}$1${RESET}`)
    f = f.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${CYAN}$1${RESET} ${DIM}($2)${RESET}`)
    f = f.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)
    return f
  }).join('\n')
}
