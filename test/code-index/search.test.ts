import { describe, it, expect } from 'vitest'
import { SearchEngine, createSearchEngine } from '../../src/code-index/search.js'
import { CodeIndex, Symbol, CodeBlock } from '../../src/code-index/types.js'

describe('搜索引擎', () => {
  const createTestIndex = (): CodeIndex => {
    const symbols = new Map<string, Symbol[]>()
    const blocks: CodeBlock[] = []

    // 添加测试符号
    symbols.set('getUserById', [{
      name: 'getUserById',
      kind: 'function',
      file: 'src/user-service.ts',
      startLine: 10,
      endLine: 20,
      content: 'function getUserById(id: number) { return db.find(id); }',
      exportKind: 'named',
    }])

    symbols.set('UserService', [{
      name: 'UserService',
      kind: 'class',
      file: 'src/user-service.ts',
      startLine: 5,
      endLine: 50,
      content: 'class UserService { ... }',
      exportKind: 'named',
    }])

    symbols.set('createOrder', [{
      name: 'createOrder',
      kind: 'function',
      file: 'src/order-service.ts',
      startLine: 15,
      endLine: 30,
      content: 'function createOrder(data: OrderData) { ... }',
      exportKind: 'named',
    }])

    symbols.set('getUser', [{
      name: 'getUser',
      kind: 'method',
      file: 'src/user-service.ts',
      startLine: 25,
      endLine: 35,
      content: 'getUser(id: number) { return this.getUserById(id); }',
      parentName: 'UserService',
    }])

    // 添加测试代码块
    blocks.push({
      file: 'src/user-service.ts',
      startLine: 10,
      endLine: 20,
      content: 'function getUserById(id: number) { return db.find(id); }',
      symbols: [symbols.get('getUserById')![0]],
    })

    blocks.push({
      file: 'src/user-service.ts',
      startLine: 5,
      endLine: 50,
      content: 'class UserService { ... }',
      symbols: [symbols.get('UserService')![0]],
    })

    blocks.push({
      file: 'src/order-service.ts',
      startLine: 15,
      endLine: 30,
      content: 'function createOrder(data: OrderData) { ... }',
      symbols: [symbols.get('createOrder')![0]],
    })

    return {
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fileCount: 2,
        symbolCount: 4,
        projectRoot: '/test',
      },
      symbols,
      references: new Map(),
      blocks,
      files: ['src/user-service.ts', 'src/order-service.ts'],
    }
  }

  describe('SearchEngine', () => {
    it('基本搜索', async () => {
      const index = createTestIndex()
      const engine = new SearchEngine(index)

      const results = await engine.search('getUser')
      expect(results.length).toBeGreaterThan(0)
    })

    it('搜索返回相关结果', async () => {
      const index = createTestIndex()
      const engine = new SearchEngine(index)

      const results = await engine.search('getUserById')
      expect(results.length).toBeGreaterThan(0)

      // 应该找到 user-service.ts
      const userServiceResult = results.find(r => r.file.includes('user-service'))
      expect(userServiceResult).toBeDefined()
    })

    it('测试文件降权', async () => {
      const index = createTestIndex()
      // 添加测试文件
      index.symbols.set('testUser', [{
        name: 'testUser',
        kind: 'function',
        file: 'test/user-service.test.ts',
        startLine: 1,
        endLine: 10,
        content: 'function testUser() { ... }',
      }])

      const engine = new SearchEngine(index)
      const results = await engine.search('user')

      // 测试文件应该排在后面
      const testResult = results.find(r => r.file.includes('test'))
      const srcResult = results.find(r => r.file.includes('src'))

      if (testResult && srcResult) {
        expect(srcResult.score).toBeGreaterThan(testResult.score)
      }
    })

    it('定义优先', async () => {
      const index = createTestIndex()
      const engine = new SearchEngine(index)

      const results = await engine.search('UserService')

      // 类定义应该有更高的优先级
      const classResult = results.find(r =>
        r.blocks.some(b => b.symbols.some(s => s.kind === 'class'))
      )
      expect(classResult).toBeDefined()
    })

    it('limit 限制结果数量', async () => {
      const index = createTestIndex()
      const engine = new SearchEngine(index)

      const results = await engine.search('user', { limit: 1 })
      expect(results.length).toBeLessThanOrEqual(1)
    })
  })

  describe('rrfFuse', () => {
    it('融合两个排序', () => {
      const index = createTestIndex()
      const engine = new SearchEngine(index)

      const ranking1 = [
        { id: 'a', score: 1 },
        { id: 'b', score: 0.8 },
        { id: 'c', score: 0.6 },
      ]

      const ranking2 = [
        { id: 'b', score: 1 },
        { id: 'c', score: 0.9 },
        { id: 'a', score: 0.7 },
      ]

      const fused = engine.rrfFuse([ranking1, ranking2])

      expect(fused.length).toBe(3)
      // b 在两个排序中都靠前，应该排第一
      expect(fused[0].id).toBe('b')
    })

    it('空排序返回空数组', () => {
      const index = createTestIndex()
      const engine = new SearchEngine(index)

      const fused = engine.rrfFuse([])
      expect(fused).toEqual([])
    })
  })

  describe('createSearchEngine', () => {
    it('创建搜索引擎', () => {
      const index = createTestIndex()
      const engine = createSearchEngine(index)
      expect(engine).toBeInstanceOf(SearchEngine)
    })
  })
})
