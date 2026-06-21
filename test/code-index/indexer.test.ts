import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { buildIndex, updateIndex, getIndexStats } from '../../src/code-index/indexer.js'

describe('索引构建器', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexer-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createFile(relativePath: string, content: string) {
    const filePath = path.join(tmpDir, relativePath)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  it('buildIndex 构建完整索引', async () => {
    createFile('src/index.ts', `
function main() {
  console.log("hello");
}
`)
    createFile('src/utils.ts', `
export function add(a: number, b: number) {
  return a + b;
}
`)

    const index = await buildIndex(tmpDir)

    expect(index.files.length).toBe(2)
    expect(index.symbols.has('main')).toBe(true)
    expect(index.symbols.has('add')).toBe(true)
    expect(index.metadata.fileCount).toBe(2)
  })

  it('buildIndex 正确提取符号', async () => {
    createFile('src/user.ts', `
interface User {
  id: number;
  name: string;
}

class UserService {
  getUser(id: number): User {
    return { id, name: "test" };
  }
}

export function createUser(name: string): User {
  return { id: 1, name };
}
`)

    const index = await buildIndex(tmpDir)

    expect(index.symbols.has('User')).toBe(true)
    expect(index.symbols.has('UserService')).toBe(true)
    expect(index.symbols.has('createUser')).toBe(true)

    const userSymbol = index.symbols.get('User')![0]
    expect(userSymbol.kind).toBe('interface')

    const serviceSymbol = index.symbols.get('UserService')![0]
    expect(serviceSymbol.kind).toBe('class')
  })

  it('buildIndex 跳过 node_modules', async () => {
    createFile('src/index.ts', 'function main() {}')
    createFile('node_modules/dep/index.ts', 'function dep() {}')

    const index = await buildIndex(tmpDir)

    expect(index.files.length).toBe(1)
    expect(index.symbols.has('main')).toBe(true)
    expect(index.symbols.has('dep')).toBe(false)
  })

  it('buildIndex 跳过不支持的文件类型', async () => {
    createFile('src/index.ts', 'function main() {}')
    createFile('README.md', '# Hello')

    const index = await buildIndex(tmpDir)

    expect(index.files.length).toBe(1)
    expect(index.files[0]).toContain('index.ts')
  })

  it('updateIndex 增量更新索引', async () => {
    createFile('src/index.ts', `
function main() {
  console.log("hello");
}
`)

    // 初始构建
    const index1 = await buildIndex(tmpDir)
    expect(index1.symbols.has('main')).toBe(true)

    // 添加新文件
    createFile('src/utils.ts', `
export function helper() {
  return 42;
}
`)

    // 增量更新
    const index2 = await updateIndex(tmpDir)

    expect(index2.symbols.has('main')).toBe(true)
    expect(index2.symbols.has('helper')).toBe(true)
    expect(index2.files.length).toBe(2)
  })

  it('getIndexStats 返回正确的统计信息', async () => {
    createFile('src/index.ts', `
function main() {}
function helper() {}
class MyClass {}
`)

    const index = await buildIndex(tmpDir)
    const stats = getIndexStats(index)

    expect(stats.fileCount).toBe(1)
    expect(stats.symbolCount).toBeGreaterThanOrEqual(3)
    expect(stats.symbolsByKind['function']).toBeGreaterThanOrEqual(2)
    expect(stats.symbolsByKind['class']).toBe(1)
  })

  it('空目录返回空索引', async () => {
    const index = await buildIndex(tmpDir)

    expect(index.files.length).toBe(0)
    expect(index.symbols.size).toBe(0)
    expect(index.blocks.length).toBe(0)
  })

  it('buildIndex 生成代码块', async () => {
    createFile('src/index.ts', `
function foo() {
  return 1;
}

function bar() {
  return 2;
}
`)

    const index = await buildIndex(tmpDir)

    expect(index.blocks.length).toBe(2)
    expect(index.blocks[0].symbols.length).toBe(1)
    expect(index.blocks[1].symbols.length).toBe(1)
  })
})
