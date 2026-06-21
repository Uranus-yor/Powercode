/**
 * 索引构建器
 * 扫描项目文件，调用解析器提取符号，构建索引
 */

import fs from 'fs'
import path from 'path'
import { CodeIndex, Symbol, CodeBlock, IndexConfig, DEFAULT_INDEX_CONFIG } from './types.js'
import { parseCode } from './parser.js'
import { saveIndex, loadIndex, indexExists, createEmptyIndex } from './storage.js'

/** 文件信息 */
interface FileInfo {
  path: string
  relativePath: string
  mtime: number
}

/** 扫描目录获取文件列表 */
function scanFiles(
  dir: string,
  config: IndexConfig,
  baseDir: string = dir
): FileInfo[] {
  const files: FileInfo[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(baseDir, fullPath)

    if (entry.isDirectory()) {
      // 跳过忽略的目录
      if (config.ignoreDirs?.includes(entry.name)) {
        continue
      }
      // 递归扫描子目录
      files.push(...scanFiles(fullPath, config, baseDir))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      // 检查文件扩展名
      if (!config.extensions?.includes(ext)) {
        continue
      }

      try {
        const stat = fs.statSync(fullPath)
        // 检查文件大小
        if (config.maxFileSize && stat.size > config.maxFileSize) {
          continue
        }

        files.push({
          path: fullPath,
          relativePath,
          mtime: stat.mtimeMs,
        })
      } catch {
        // 跳过无法读取的文件
      }
    }
  }

  return files
}

/** 构建索引 */
export async function buildIndex(
  projectRoot: string,
  config: IndexConfig = DEFAULT_INDEX_CONFIG
): Promise<CodeIndex> {
  const index = createEmptyIndex(projectRoot)
  const files = scanFiles(projectRoot, config)

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8')
      const { symbols, blocks } = parseCode(file.relativePath, content)

      // 添加符号到符号表
      for (const symbol of symbols) {
        const existing = index.symbols.get(symbol.name) || []
        existing.push(symbol)
        index.symbols.set(symbol.name, existing)
      }

      // 添加代码块
      index.blocks.push(...blocks)

      // 添加文件到文件列表
      index.files.push(file.relativePath)
    } catch {
      // 跳过解析失败的文件
    }
  }

  // 更新元数据
  index.metadata.fileCount = index.files.length
  index.metadata.symbolCount = Array.from(index.symbols.values()).reduce(
    (sum, symbols) => sum + symbols.length,
    0
  )

  // 保存索引
  saveIndex(projectRoot, index)

  return index
}

/** 增量更新索引（只更新变更的文件） */
export async function updateIndex(
  projectRoot: string,
  config: IndexConfig = DEFAULT_INDEX_CONFIG
): Promise<CodeIndex> {
  // 如果索引不存在，全量构建
  if (!indexExists(projectRoot)) {
    return buildIndex(projectRoot, config)
  }

  const existingIndex = loadIndex(projectRoot)
  if (!existingIndex) {
    return buildIndex(projectRoot, config)
  }

  const files = scanFiles(projectRoot, config)
  const changedFiles: FileInfo[] = []

  // 找出变更的文件
  for (const file of files) {
    const existingFile = existingIndex.files.includes(file.relativePath)
    if (!existingFile) {
      // 新文件
      changedFiles.push(file)
    } else {
      // 检查修改时间
      try {
        const stat = fs.statSync(file.path)
        if (stat.mtimeMs > existingIndex.metadata.updatedAt) {
          changedFiles.push(file)
        }
      } catch {
        changedFiles.push(file)
      }
    }
  }

  // 如果没有变更，直接返回现有索引
  if (changedFiles.length === 0) {
    return existingIndex
  }

  // 移除变更文件的旧符号
  for (const file of changedFiles) {
    for (const [name, symbols] of existingIndex.symbols) {
      const filtered = symbols.filter(s => s.file !== file.relativePath)
      if (filtered.length === 0) {
        existingIndex.symbols.delete(name)
      } else {
        existingIndex.symbols.set(name, filtered)
      }
    }

    // 移除旧代码块
    existingIndex.blocks = existingIndex.blocks.filter(
      b => b.file !== file.relativePath
    )
  }

  // 添加变更文件的新符号
  for (const file of changedFiles) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8')
      const { symbols, blocks } = parseCode(file.relativePath, content)

      for (const symbol of symbols) {
        const existing = existingIndex.symbols.get(symbol.name) || []
        existing.push(symbol)
        existingIndex.symbols.set(symbol.name, existing)
      }

      existingIndex.blocks.push(...blocks)
    } catch {
      // 跳过解析失败的文件
    }
  }

  // 更新文件列表
  existingIndex.files = files.map(f => f.relativePath)

  // 更新元数据
  existingIndex.metadata.updatedAt = Date.now()
  existingIndex.metadata.fileCount = existingIndex.files.length
  existingIndex.metadata.symbolCount = Array.from(
    existingIndex.symbols.values()
  ).reduce((sum, symbols) => sum + symbols.length, 0)

  // 保存索引
  saveIndex(projectRoot, existingIndex)

  return existingIndex
}

/** 获取索引统计信息 */
export function getIndexStats(index: CodeIndex): {
  fileCount: number
  symbolCount: number
  blockCount: number
  symbolsByKind: Record<string, number>
} {
  const symbolsByKind: Record<string, number> = {}

  for (const symbols of index.symbols.values()) {
    for (const symbol of symbols) {
      symbolsByKind[symbol.kind] = (symbolsByKind[symbol.kind] || 0) + 1
    }
  }

  return {
    fileCount: index.metadata.fileCount,
    symbolCount: index.metadata.symbolCount,
    blockCount: index.blocks.length,
    symbolsByKind,
  }
}
