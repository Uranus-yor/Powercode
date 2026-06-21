import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  saveIndex,
  loadIndex,
  indexExists,
  deleteIndex,
  getIndexMetadata,
  createEmptyIndex,
} from '../../src/code-index/storage.js'
import { CodeIndex, Symbol } from '../../src/code-index/types.js'

describe('索引存储模块', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-index-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('createEmptyIndex 创建空索引', () => {
    const index = createEmptyIndex(tmpDir)
    expect(index.metadata.projectRoot).toBe(tmpDir)
    expect(index.symbols.size).toBe(0)
    expect(index.references.size).toBe(0)
    expect(index.blocks).toEqual([])
    expect(index.files).toEqual([])
  })

  it('saveIndex 和 loadIndex 保存和读取索引', () => {
    const index = createEmptyIndex(tmpDir)

    // 添加测试数据
    const symbol: Symbol = {
      name: 'greet',
      kind: 'function',
      file: 'src/index.ts',
      startLine: 1,
      endLine: 5,
      content: 'function greet() { return "hello" }',
    }
    index.symbols.set('greet', [symbol])
    index.files.push('src/index.ts')

    saveIndex(tmpDir, index)

    const loaded = loadIndex(tmpDir)
    expect(loaded).not.toBeNull()
    expect(loaded!.symbols.get('greet')).toHaveLength(1)
    expect(loaded!.symbols.get('greet')![0].name).toBe('greet')
    expect(loaded!.files).toEqual(['src/index.ts'])
  })

  it('indexExists 检查索引是否存在', () => {
    expect(indexExists(tmpDir)).toBe(false)

    const index = createEmptyIndex(tmpDir)
    saveIndex(tmpDir, index)

    expect(indexExists(tmpDir)).toBe(true)
  })

  it('deleteIndex 删除索引', () => {
    const index = createEmptyIndex(tmpDir)
    saveIndex(tmpDir, index)
    expect(indexExists(tmpDir)).toBe(true)

    deleteIndex(tmpDir)
    expect(indexExists(tmpDir)).toBe(false)
  })

  it('getIndexMetadata 获取索引元数据', () => {
    const index = createEmptyIndex(tmpDir)
    index.metadata.fileCount = 10
    index.metadata.symbolCount = 50
    saveIndex(tmpDir, index)

    const metadata = getIndexMetadata(tmpDir)
    expect(metadata).not.toBeNull()
    expect(metadata!.fileCount).toBe(10)
    expect(metadata!.symbolCount).toBe(50)
  })

  it('loadIndex 在索引不存在时返回 null', () => {
    const loaded = loadIndex(tmpDir)
    expect(loaded).toBeNull()
  })

  it('saveIndex 正确序列化 Map 类型', () => {
    const index = createEmptyIndex(tmpDir)

    // 添加多个符号
    index.symbols.set('func1', [{
      name: 'func1',
      kind: 'function',
      file: 'a.ts',
      startLine: 1,
      endLine: 3,
      content: 'function func1() {}',
    }])
    index.symbols.set('func2', [{
      name: 'func2',
      kind: 'function',
      file: 'b.ts',
      startLine: 1,
      endLine: 3,
      content: 'function func2() {}',
    }])

    saveIndex(tmpDir, index)
    const loaded = loadIndex(tmpDir)

    expect(loaded!.symbols.size).toBe(2)
    expect(loaded!.symbols.has('func1')).toBe(true)
    expect(loaded!.symbols.has('func2')).toBe(true)
  })
})
