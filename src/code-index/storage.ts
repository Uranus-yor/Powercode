/**
 * 索引存储模块
 * 负责索引的持久化存储和读取
 */

import fs from 'fs'
import path from 'path'
import { CodeIndex, IndexMetadata, Symbol, Reference, CodeBlock } from './types.js'

/** 索引文件扩展名 */
const INDEX_FILE = 'code-index.json'
const INDEX_DIR = '.powercode/index'

/** 获取索引目录路径 */
export function getIndexDir(projectRoot: string): string {
  return path.join(projectRoot, INDEX_DIR)
}

/** 获取索引文件路径 */
export function getIndexPath(projectRoot: string): string {
  return path.join(projectRoot, INDEX_DIR, INDEX_FILE)
}

/** 确保索引目录存在 */
function ensureIndexDir(projectRoot: string): void {
  const dir = getIndexDir(projectRoot)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/** 序列化索引为可存储格式 */
function serializeIndex(index: CodeIndex): string {
  const data = {
    metadata: index.metadata,
    symbols: Object.fromEntries(index.symbols),
    references: Object.fromEntries(index.references),
    blocks: index.blocks,
    files: index.files,
  }
  return JSON.stringify(data, null, 2)
}

/** 反序列化索引 */
function deserializeIndex(data: string): CodeIndex {
  const parsed = JSON.parse(data)
  return {
    metadata: parsed.metadata,
    symbols: new Map(Object.entries(parsed.symbols)),
    references: new Map(Object.entries(parsed.references)),
    blocks: parsed.blocks,
    files: parsed.files,
  }
}

/** 保存索引到磁盘 */
export function saveIndex(projectRoot: string, index: CodeIndex): void {
  ensureIndexDir(projectRoot)
  const indexPath = getIndexPath(projectRoot)
  const content = serializeIndex(index)
  fs.writeFileSync(indexPath, content, 'utf-8')
}

/** 从磁盘读取索引 */
export function loadIndex(projectRoot: string): CodeIndex | null {
  const indexPath = getIndexPath(projectRoot)
  if (!fs.existsSync(indexPath)) {
    return null
  }
  try {
    const content = fs.readFileSync(indexPath, 'utf-8')
    return deserializeIndex(content)
  } catch {
    return null
  }
}

/** 检查索引是否存在 */
export function indexExists(projectRoot: string): boolean {
  const indexPath = getIndexPath(projectRoot)
  return fs.existsSync(indexPath)
}

/** 删除索引 */
export function deleteIndex(projectRoot: string): void {
  const indexPath = getIndexPath(projectRoot)
  if (fs.existsSync(indexPath)) {
    fs.unlinkSync(indexPath)
  }
}

/** 获取索引元数据 */
export function getIndexMetadata(projectRoot: string): IndexMetadata | null {
  const indexPath = getIndexPath(projectRoot)
  if (!fs.existsSync(indexPath)) {
    return null
  }
  try {
    const content = fs.readFileSync(indexPath, 'utf-8')
    const data = JSON.parse(content)
    return data.metadata
  } catch {
    return null
  }
}

/** 检查文件是否需要重新索引（基于修改时间） */
export function needsReindex(projectRoot: string, filePath: string): boolean {
  const metadata = getIndexMetadata(projectRoot)
  if (!metadata) {
    return true
  }

  try {
    const stat = fs.statSync(filePath)
    return stat.mtimeMs > metadata.updatedAt
  } catch {
    return true
  }
}

/** 创建空索引 */
export function createEmptyIndex(projectRoot: string): CodeIndex {
  return {
    metadata: {
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fileCount: 0,
      symbolCount: 0,
      projectRoot,
    },
    symbols: new Map(),
    references: new Map(),
    blocks: [],
    files: [],
  }
}
