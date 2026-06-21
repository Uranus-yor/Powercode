import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { POWER_CODE_DIR, POWER_CODE_HISTORY_PATH } from './config.js'

/** 历史记录条目类型 */
type HistoryEntry = {
  display: string
  timestamp: number
  project: string
  sessionId: string
}

/** 最大历史记录条目数 */
const MAX_ENTRIES = 500

/**
 * 加载历史记录条目
 * 从 JSONL 文件中读取历史输入记录
 */
export async function loadHistoryEntries(): Promise<string[]> {
  try {
    const raw = await readFile(POWER_CODE_HISTORY_PATH, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    const entries: string[] = []
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as HistoryEntry
        if (typeof entry.display === 'string') {
          entries.push(entry.display)
        }
      } catch {
        // skip malformed lines
      }
    }
    return entries
  } catch {
    return []
  }
}

/**
 * 保存历史记录条目
 * 增量保存新条目，并自动裁剪超过最大限制的旧条目
 */
export async function saveHistoryEntries(
  entries: string[],
  cwd: string,
  sessionId: string,
): Promise<void> {
  await mkdir(POWER_CODE_DIR, { recursive: true })

  const existing = await loadHistoryEntries()
  // Find which entries are new
  const existingSet = new Set(existing)
  const newEntries = entries.filter(e => !existingSet.has(e))

  if (newEntries.length === 0) return

  const now = Date.now()
  const lines = newEntries.map(display =>
    JSON.stringify({ display, timestamp: now, project: cwd, sessionId }),
  )

  await appendFile(POWER_CODE_HISTORY_PATH, lines.join('\n') + '\n', 'utf8')

  // Trim to MAX_ENTRIES if needed
  try {
    const raw = await readFile(POWER_CODE_HISTORY_PATH, 'utf8')
    const allLines = raw.trim().split('\n').filter(Boolean)
    if (allLines.length > MAX_ENTRIES) {
      const { writeFile } = await import('node:fs/promises')
      const kept = allLines.slice(-MAX_ENTRIES)
      await writeFile(
        POWER_CODE_HISTORY_PATH,
        kept.join('\n') + '\n',
        'utf8',
      )
    }
  } catch {
    // ignore trim errors
  }
}
