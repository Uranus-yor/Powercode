import type { BackgroundTask } from '../core/types.js'
import path from 'node:path'
import process from 'node:process'
import type { RuntimeConfig } from '../config.js'
import type { SlashCommand } from '../cli-commands.js'
import type { PermissionRequest } from '../permissions.js'
import {
  RESET, DIM, BOLD, REVERSE,
  FG, FG_DIM, FG_BRIGHT,
  SUCCESS, ERROR, WARNING, INFO,
  ACCENT, ACCENT2,
  BRIGHT_CYAN, BRIGHT_GREEN, BRIGHT_RED, BRIGHT_YELLOW,
  CYAN, GREEN, YELLOW, BLUE, MAGENTA,
  BORDER_DIM,
  stripAnsi, applyGradient,
} from './colors.js'

// ═══════════════════════════════════════════════════════════════
// 字符宽度计算
// ═══════════════════════════════════════════════════════════════

export function charDisplayWidth(char: string): number {
  const code = char.codePointAt(0)
  if (code === undefined) return 0
  if (
    code >= 0x1100 &&
    (code <= 0x115f || code === 0x2329 || code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faf6) ||
      (code >= 0x20000 && code <= 0x3fffd))
  ) return 2
  return 1
}

export function stringDisplayWidth(input: string): number {
  return [...stripAnsi(input)].reduce((sum, c) => sum + charDisplayWidth(c), 0)
}

export function displayWidth(str: string): number {
  return stringDisplayWidth(str)
}

// ═══════════════════════════════════════════════════════════════
// 文本处理
// ═══════════════════════════════════════════════════════════════

function truncatePlain(input: string, width: number): string {
  if (width <= 0) return ''
  if (stringDisplayWidth(input) <= width) return input
  if (width <= 3) return input.slice(0, width)
  const target = width - 3
  let current = ''
  let used = 0
  for (const char of [...input]) {
    const next = charDisplayWidth(char)
    if (used + next > target) break
    current += char
    used += next
  }
  return `${current}...`
}

function padPlain(input: string, width: number): string {
  const visible = stringDisplayWidth(input)
  return visible >= width ? input : `${input}${' '.repeat(width - visible)}`
}

function truncatePathMiddle(input: string, width: number): string {
  if (width <= 0 || stringDisplayWidth(input) <= width) return input
  if (width <= 5) return truncatePlain(input, width)
  const keep = width - 3
  const leftTarget = Math.ceil(keep / 2)
  const rightTarget = Math.floor(keep / 2)
  let left = '', leftWidth = 0
  for (const char of [...input]) {
    const next = charDisplayWidth(char)
    if (leftWidth + next > leftTarget) break
    left += char
    leftWidth += next
  }
  let right = '', rightWidth = 0
  for (const char of [...input].reverse()) {
    const next = charDisplayWidth(char)
    if (rightWidth + next > rightTarget) break
    right = `${char}${right}`
    rightWidth += next
  }
  return `${left}...${right}`
}

function joinWithinWidth(segments: string[], sep: string, max: number): string {
  if (max <= 0 || segments.length === 0) return ''
  let output = ''
  for (const seg of segments) {
    const candidate = output.length > 0 ? `${output}${sep}${seg}` : seg
    if (stringDisplayWidth(candidate) <= max) { output = candidate; continue }
    if (!output) return truncatePlain(stripAnsi(seg), max)
    const withDots = `${output}${sep}${DIM}...${RESET}`
    return stringDisplayWidth(withDots) <= max ? withDots : output
  }
  return output
}

// ═══════════════════════════════════════════════════════════════
// 分隔线
// ═══════════════════════════════════════════════════════════════

/** 渲染水平分隔线 */
export function renderDivider(width: number, label?: string): string {
  const ch = '\u2500' // ─
  if (!label) return `${DIM}${ch.repeat(width)}${RESET}`
  const labelW = stringDisplayWidth(label) + 2
  const dashN = Math.max(1, width - labelW)
  return `${DIM}${ch.repeat(Math.floor(dashN / 2))} ${FG_DIM}${label}${RESET} ${DIM}${ch.repeat(Math.ceil(dashN / 2))}${RESET}`
}

// ═══════════════════════════════════════════════════════════════
// renderPanel - 保留兼容（用于 session picker 等特殊场景）
// ═══════════════════════════════════════════════════════════════

export function renderPanel(
  title: string,
  body: string,
  options: { rightTitle?: string; minBodyLines?: number; width?: number } = {},
): string {
  const width = options.width ?? Math.max(60, process.stdout.columns ?? 100)
  const bodyLines = body.length > 0 ? body.split('\n') : []
  const renderedLines = bodyLines.flatMap(l => wrapPanelBodyLine(l, width))
  const minBodyLines = options.minBodyLines ?? 0
  while (renderedLines.length < minBodyLines) renderedLines.push('')

  const result: string[] = []
  result.push(renderDivider(width, title))
  result.push(...renderedLines)
  return result.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 会话内容行包裹
// ═══════════════════════════════════════════════════════════════

export function wrapPanelBodyLine(line: string, width: number): string[] {
  const maxW = width
  if (maxW <= 0) return ['']
  const hasAnsi = /\u001b\[[0-9;]*m/.test(line)
  if (!hasAnsi) {
    if (stringDisplayWidth(line) <= maxW) return [line]
    const parts: string[] = []
    let cur = '', curW = 0
    for (const ch of [...line]) {
      const cw = charDisplayWidth(ch)
      if (curW + cw > maxW) { parts.push(cur); cur = ch; curW = cw; continue }
      cur += ch; curW += cw
    }
    if (cur.length > 0) parts.push(cur)
    return parts
  }
  const plain = stripAnsi(line)
  if (stringDisplayWidth(plain) <= maxW) return [line]
  const parts: string[] = []
  let pi = 0, li = 0, curW = 0, ps = 0
  while (pi < plain.length && li < line.length) {
    const m = line.slice(li).match(/^\u001b\[[0-9;]*m/)
    if (m) { li += m[0].length; continue }
    const ch = plain[pi], cw = charDisplayWidth(ch)
    if (curW + cw > maxW) { parts.push(line.slice(ps, li)); ps = li; curW = 0; continue }
    curW += cw; pi++; li++
  }
  if (li > ps) parts.push(line.slice(ps))
  return parts.length > 0 ? parts : ['']
}

// ═══════════════════════════════════════════════════════════════
// 上下文使用率徽章
// ═══════════════════════════════════════════════════════════════

export function renderContextBadge(stats: {
  utilization: number
  warningLevel: 'normal' | 'warning' | 'critical' | 'blocked'
  accounting?: { providerUsageTokens: number; estimatedTokens: number; source: string } | null
}): string {
  const { utilization, warningLevel, accounting } = stats
  const pct = Math.round(utilization * 100)
  const colorMap = { normal: SUCCESS, warning: WARNING, critical: ERROR, blocked: BRIGHT_RED }
  const color = colorMap[warningLevel]
  const filled = Math.round(utilization * 10)
  const bar = '\u2593'.repeat(filled) + '\u2591'.repeat(10 - filled)
  const src = accounting?.source === 'provider_usage' ? ''
    : accounting?.source === 'provider_usage_plus_estimate' ? '+est'
    : accounting?.source === 'estimate_only' ? 'est' : ''
  return `${color}${pct}%${RESET} ${DIM}${bar}${src ? ` ${src}` : ''}${RESET}`
}

// ═══════════════════════════════════════════════════════════════
// 顶部横幅 - 系统信息（无边框设计）
// ═══════════════════════════════════════════════════════════════

export function renderBanner(
  runtime: RuntimeConfig | null,
  cwd: string,
  _permissionSummary: string[],
  session: {
    transcriptCount: number; messageCount: number; skillCount: number
    mcpTotalCount: number; mcpConnectedCount: number
    mcpConnectingCount: number; mcpErrorCount: number
    contextStats?: { utilization: number; warningLevel: 'normal' | 'warning' | 'critical' | 'blocked'; accounting?: { providerUsageTokens: number; estimatedTokens: number; source: string } | null } | null
  },
): string {
  const width = Math.max(60, process.stdout.columns ?? 100)
  const cwdName = path.basename(cwd) || cwd
  const model = runtime?.model ?? 'not-configured'
  const provider = runtime?.baseUrl
    ? runtime.baseUrl.replace(/^https?:\/\//, '').split('/')[0] || 'custom'
    : 'offline'

  // 行1: 品牌 + 项目
  const brand = applyGradient('PowerCode')
  const pathStr = `${ACCENT}${BOLD}${cwdName}${RESET} ${DIM}${truncatePathMiddle(cwd, Math.max(20, width - stringDisplayWidth(cwdName) - 20))}${RESET}`
  const line1 = `${brand}  ${DIM}\u2502${RESET}  ${pathStr}`

  // 行2: 状态徽章
  const badges = [
    `${DIM}model${RESET} ${GREEN}${model}${RESET}`,
    `${DIM}via${RESET} ${CYAN}${provider}${RESET}`,
    `${DIM}msgs${RESET} ${BRIGHT_CYAN}${session.messageCount}${RESET}`,
    ...(session.contextStats ? [`${DIM}ctx${RESET} ${renderContextBadge(session.contextStats)}`] : []),
    `${DIM}mcp${RESET} ${MAGENTA}${session.mcpConnectedCount}/${session.mcpTotalCount}${RESET}`,
    ...(session.mcpErrorCount > 0 ? [`${DIM}err${RESET} ${BRIGHT_RED}${session.mcpErrorCount}${RESET}`] : []),
  ]
  const line2 = joinWithinWidth(badges, ` ${DIM}\u00b7${RESET} `, width)

  return `${line1}\n${line2}`
}

// ═══════════════════════════════════════════════════════════════
// 底部状态栏
// ═══════════════════════════════════════════════════════════════

export function renderStatusLine(status: string | null): string {
  if (!status) return `${DIM}ready${RESET}`
  return `${WARNING}${BOLD}${status}${RESET}`
}

export function renderToolPanel(
  activeTool: string | null,
  recentTools: Array<{ name: string; status: 'success' | 'error' }>,
  backgroundTasks: BackgroundTask[] = [],
): string {
  const items: string[] = []
  if (activeTool) items.push(`${WARNING}\u25b6${RESET} ${activeTool}`)
  const running = backgroundTasks.filter(t => t.status === 'running')
  if (running.length > 0) {
    items.push(`${BRIGHT_CYAN}bg${RESET} ${running.length === 1 ? truncatePlain(running[0]!.command, 40) : `${running.length} shells`}`)
  }
  if (recentTools.length === 0 && running.length === 0) {
    items.push(`${DIM}no recent tools${RESET}`)
  }
  for (const tool of recentTools.slice(-5).reverse()) {
    const s = tool.status === 'success' ? `${SUCCESS}\u2713${RESET}` : `${ERROR}\u2717${RESET}`
    items.push(`${s} ${tool.name}`)
  }
  return items.join(` ${DIM}\u00b7${RESET} `)
}

export function renderFooterBar(
  status: string | null,
  toolsEnabled: boolean,
  skillsEnabled: boolean,
  mcpStatus: { total: number; connected: number; connecting: number; error: number; toolCount: number },
  backgroundTasks: BackgroundTask[] = [],
  compressionStatus?: string | null,
): string {
  const width = Math.max(60, process.stdout.columns ?? 100)
  const dot = `${DIM}\u00b7${RESET}`

  const left = renderStatusLine(status)

  const parts: string[] = []
  parts.push(`${DIM}tools${RESET} ${toolsEnabled ? `${SUCCESS}on${RESET}` : `${ERROR}off${RESET}`}`)
  parts.push(`${DIM}skills${RESET} ${skillsEnabled ? `${SUCCESS}on${RESET}` : `${ERROR}off${RESET}`}`)
  if (mcpStatus.total > 0) {
    const mc = mcpStatus.error > 0 ? BRIGHT_RED : mcpStatus.connecting > 0 ? WARNING : SUCCESS
    parts.push(`${DIM}mcp${RESET} ${mc}${mcpStatus.connected}/${mcpStatus.total}${RESET}`)
  }
  const bg = backgroundTasks.filter(t => t.status === 'running')
  if (bg.length > 0) parts.push(`${DIM}shells${RESET} ${BRIGHT_CYAN}${bg.length}${RESET}`)
  if (compressionStatus) parts.push(`${WARNING}${compressionStatus}${RESET}`)

  const right = parts.join(` ${dot} `)
  const gap = Math.max(2, width - stringDisplayWidth(left) - stringDisplayWidth(right))
  return `${DIM}\u2500${RESET} ${left}${' '.repeat(gap)}${right} ${DIM}\u2500${RESET}`
}

// ═══════════════════════════════════════════════════════════════
// 斜杠命令菜单
// ═══════════════════════════════════════════════════════════════

export function renderSlashMenu(commands: SlashCommand[], selectedIndex: number): string {
  if (commands.length === 0) return `${DIM}no matching commands${RESET}`

  const categoryOrder = ['Session', 'Info', 'File Ops', 'Context', 'Dev']
  const groups = new Map<string, SlashCommand[]>()
  for (const cmd of commands) {
    const list = groups.get(cmd.category) ?? []
    list.push(cmd)
    groups.set(cmd.category, list)
  }

  const lines: string[] = []
  let idx = 0
  const safe = Math.min(selectedIndex, commands.length - 1)

  for (const cat of categoryOrder) {
    const cmds = groups.get(cat)
    if (!cmds || cmds.length === 0) continue
    lines.push(`${DIM}\u2500\u2500 ${cat}${RESET}`)
    for (const cmd of cmds) {
      const usage = padPlain(cmd.usage, 24)
      const prefix = idx === safe ? `${REVERSE} ${usage} ${RESET}` : ` ${usage} `
      lines.push(`${prefix} ${DIM}${truncatePlain(cmd.description, 50)}${RESET}`)
      idx++
    }
  }

  for (const cmd of commands) {
    if (!categoryOrder.includes(cmd.category)) {
      const usage = padPlain(cmd.usage, 24)
      const prefix = idx === safe ? `${REVERSE} ${usage} ${RESET}` : ` ${usage} `
      lines.push(`${prefix} ${DIM}${truncatePlain(cmd.description, 50)}${RESET}`)
      idx++
    }
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// 权限提示
// ═══════════════════════════════════════════════════════════════

type PermissionPromptRenderOptions = {
  expanded?: boolean; scrollOffset?: number; selectedChoiceIndex?: number
  feedbackMode?: boolean; feedbackInput?: string
}

function flattenDetailLines(details: string[]): string[] {
  const lines: string[] = []
  details.forEach((d, i) => { if (i > 0) lines.push(''); lines.push(...d.split('\n')) })
  return lines
}

function sliceVisibleDetails(detailLines: string[], expanded: boolean, scrollOffset: number) {
  if (!expanded) {
    const limit = 16
    if (detailLines.length <= limit) return { lines: detailLines, maxScroll: 0, hiddenCount: 0 }
    return { lines: detailLines.slice(0, limit), maxScroll: 0, hiddenCount: detailLines.length - limit }
  }
  const rows = process.stdout.rows ?? 40
  const win = Math.max(8, rows - 20)
  const maxScroll = Math.max(0, detailLines.length - win)
  const off = Math.max(0, Math.min(scrollOffset, maxScroll))
  return { lines: detailLines.slice(off, off + win), maxScroll, hiddenCount: 0 }
}

export function getPermissionPromptMaxScrollOffset(request: PermissionRequest, options: PermissionPromptRenderOptions = {}): number {
  const details = request.kind === 'edit' ? colorizeEditPermissionDetails(request.details) : request.details
  const dl = flattenDetailLines(details)
  if (!(options.expanded ?? false)) return 0
  const rows = process.stdout.rows ?? 40
  return Math.max(0, dl.length - Math.max(8, rows - 20))
}

export function renderPermissionPrompt(request: PermissionRequest, options: PermissionPromptRenderOptions = {}): string {
  const details = request.kind === 'edit' ? colorizeEditPermissionDetails(request.details) : request.details
  const expanded = options.expanded ?? false
  const scrollOffset = options.scrollOffset ?? 0
  const selectedChoiceIndex = options.selectedChoiceIndex ?? 0
  const feedbackMode = options.feedbackMode ?? false
  const feedbackInput = options.feedbackInput ?? ''
  const dl = flattenDetailLines(details)
  const { lines: vis, maxScroll, hiddenCount } = sliceVisibleDetails(dl, expanded, scrollOffset)

  const promptLines = [
    `${WARNING}${BOLD}\u26a0 Approval Required${RESET}`,
    `${BOLD}${request.summary}${RESET}`,
    ...vis,
  ]

  if (request.kind === 'edit') {
    if (!expanded && hiddenCount > 0) {
      promptLines.push(`${DIM}... ${hiddenCount} more lines hidden | Ctrl+O expand${RESET}`)
    } else if (expanded) {
      promptLines.push(`${DIM}Ctrl+O collapse | scroll (${Math.max(0, Math.min(scrollOffset, maxScroll))}/${maxScroll})${RESET}`)
    }
  }

  return [
    ...promptLines, '',
    ...(feedbackMode
      ? [`${WARNING}${BOLD}Reject With Guidance${RESET}`, `${DIM}Type feedback, Enter submit, Esc back${RESET}`, `> ${feedbackInput}`]
      : request.choices.map((c, i) => `${i === selectedChoiceIndex ? `${REVERSE}>${RESET}` : ' '} ${c.label}`)),
    '', `${DIM}\u2191/\u2193 select \u00b7 Enter confirm \u00b7 Esc deny${RESET}`,
  ].join('\n')
}

// ═══════════════════════════════════════════════════════════════
// Diff 高亮
// ═══════════════════════════════════════════════════════════════

type DiffLineKind = 'meta' | 'add' | 'remove' | 'context'
type StyledDiffLine = { raw: string; kind: DiffLineKind; emphasisRange?: { start: number; end: number } }

function isUnifiedDiffHeader(line: string): boolean {
  return line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@ ')
}

function classifyDiffLine(line: string): DiffLineKind {
  if (isUnifiedDiffHeader(line)) return 'meta'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'remove'
  return 'context'
}

function computeChangedRange(removed: string, added: string) {
  if (!removed || !added) return null
  let prefix = 0
  const maxP = Math.min(removed.length, added.length)
  while (prefix < maxP && removed[prefix] === added[prefix]) prefix++
  let rs = removed.length - 1, as = added.length - 1
  while (rs >= prefix && as >= prefix && removed[rs] === added[as]) { rs--; as-- }
  const rr = { start: prefix, end: rs + 1 }, ar = { start: prefix, end: as + 1 }
  if (rr.start >= rr.end || ar.start >= ar.end) return null
  return { remove: rr, add: ar }
}

function applyWordEmphasis(content: string, color: string, range?: { start: number; end: number }): string {
  if (!range) return `${color}${content}${RESET}`
  const s = Math.max(0, Math.min(content.length, range.start))
  const e = Math.max(s, Math.min(content.length, range.end))
  if (s === e) return `${color}${content}${RESET}`
  return `${color}${content.slice(0, s)}${BOLD}${content.slice(s, e)}${RESET}${color}${content.slice(e)}${RESET}`
}

function renderStyledDiffLine(line: StyledDiffLine): string {
  if (line.raw.trim() === '') return line.raw
  if (line.kind === 'meta') return `${CYAN}${BOLD}${line.raw}${RESET}`
  if (line.kind === 'add' || line.kind === 'remove') {
    const sign = line.raw[0], content = line.raw.slice(1)
    const color = line.kind === 'add' ? BRIGHT_GREEN : BRIGHT_RED
    return `${color}${sign}${RESET}${applyWordEmphasis(content, color, line.emphasisRange)}`
  }
  return `${DIM}${line.raw}${RESET}`
}

function colorizeUnifiedDiffBlock(block: string): string {
  const lines = block.split('\n')
  const styled: StyledDiffLine[] = lines.map(raw => ({ raw, kind: classifyDiffLine(raw) }))
  for (let i = 0; i < styled.length; i++) {
    if (styled[i]!.kind !== 'remove') continue
    let re = i; while (re < styled.length && styled[re]!.kind === 'remove') re++
    let ae = re; while (ae < styled.length && styled[ae]!.kind === 'add') ae++
    const pair = Math.min(re - i, ae - re)
    for (let p = 0; p < pair; p++) {
      const rl = styled[i + p]!, al = styled[re + p]!
      const ranges = computeChangedRange(rl.raw.slice(1), al.raw.slice(1))
      if (ranges) { rl.emphasisRange = ranges.remove; al.emphasisRange = ranges.add }
    }
    i = ae - 1
  }
  return styled.map(renderStyledDiffLine).join('\n')
}

function looksLikeDiffBlock(detail: string): boolean {
  return detail.includes('\n') && (detail.includes('--- a/') || detail.includes('+++ b/') || detail.includes('@@ '))
}

function colorizeEditPermissionDetails(details: string[]): string[] {
  return details.map(d => looksLikeDiffBlock(d) ? colorizeUnifiedDiffBlock(d) : d)
}
