import { describe, it, expect } from 'vitest'
import { tokenize, BM25Index, SymbolBM25Index, CodeBlockBM25Index } from '../../src/code-index/bm25.js'
import { Symbol } from '../../src/code-index/types.js'

describe('BM25 搜索模块', () => {
  describe('tokenize 分词器', () => {
    it('驼峰命名分词', () => {
      const tokens = tokenize('getUserById')
      const texts = tokens.map(t => t.text)
      expect(texts).toEqual(['get', 'user', 'by', 'id'])
    })

    it('下划线命名分词', () => {
      const tokens = tokenize('get_user_by_id')
      const texts = tokens.map(t => t.text)
      expect(texts).toEqual(['get', 'user', 'by', 'id'])
    })

    it('混合命名分词', () => {
      const tokens = tokenize('getUser_byId')
      const texts = tokens.map(t => t.text)
      expect(texts).toContain('get')
      expect(texts).toContain('user')
      expect(texts).toContain('by')
      expect(texts).toContain('id')
    })

    it('中文分词', () => {
      const tokens = tokenize('用户管理模块')
      expect(tokens.length).toBeGreaterThan(0)
    })

    it('空字符串返回空数组', () => {
      expect(tokenize('')).toEqual([])
    })

    it('转换为小写', () => {
      const tokens = tokenize('UserService')
      const texts = tokens.map(t => t.text)
      expect(texts).toEqual(['user', 'service'])
    })
  })

  describe('BM25Index', () => {
    it('基本搜索', () => {
      const index = new BM25Index()
      index.addDocument('doc1', 'function getUserById')
      index.addDocument('doc2', 'function createUser')
      index.addDocument('doc3', 'function deleteUser')

      const results = index.search('getUser')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('doc1')
    })

    it('返回排序后的结果', () => {
      const index = new BM25Index()
      index.addDocument('doc1', 'user service')
      index.addDocument('doc2', 'user controller')
      index.addDocument('doc3', 'order service')

      const results = index.search('user service')
      expect(results.length).toBeGreaterThan(0)
      // doc1 应该排在最前面（包含两个查询词）
      expect(results[0].id).toBe('doc1')
    })

    it('topK 限制返回数量', () => {
      const index = new BM25Index()
      for (let i = 0; i < 20; i++) {
        index.addDocument(`doc${i}`, `document ${i}`)
      }

      const results = index.search('document', 5)
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('无匹配返回空数组', () => {
      const index = new BM25Index()
      index.addDocument('doc1', 'hello world')

      const results = index.search('xyz')
      expect(results).toEqual([])
    })

    it('清空索引', () => {
      const index = new BM25Index()
      index.addDocument('doc1', 'hello')
      index.clear()

      const results = index.search('hello')
      expect(results).toEqual([])
    })
  })

  describe('SymbolBM25Index', () => {
    const createSymbol = (name: string, content: string): Symbol => ({
      name,
      kind: 'function',
      file: 'test.ts',
      startLine: 1,
      endLine: 5,
      content,
    })

    it('搜索符号名称', () => {
      const index = new SymbolBM25Index()
      index.addSymbol(createSymbol('getUserById', 'function getUserById(id) {}'))
      index.addSymbol(createSymbol('createUser', 'function createUser(data) {}'))

      const results = index.search('getUser')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].symbol.name).toBe('getUserById')
    })

    it('搜索符号内容', () => {
      const index = new SymbolBM25Index()
      index.addSymbol(createSymbol('func1', 'function func1() { return user }'))
      index.addSymbol(createSymbol('func2', 'function func2() { return order }'))

      const results = index.search('user')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].symbol.name).toBe('func1')
    })

    it('批量添加符号', () => {
      const index = new SymbolBM25Index()
      index.addSymbols([
        createSymbol('getUser', 'function getUser() {}'),
        createSymbol('getUserById', 'function getUserById() {}'),
      ])

      const results = index.search('getUser')
      expect(results.length).toBe(2)
    })
  })

  describe('CodeBlockBM25Index', () => {
    it('搜索代码块', () => {
      const index = new CodeBlockBM25Index()
      index.addBlock({
        file: 'test.ts',
        startLine: 1,
        endLine: 5,
        content: 'function getUserById(id: number) { return db.find(id) }',
        symbols: [],
      })
      index.addBlock({
        file: 'test.ts',
        startLine: 10,
        endLine: 15,
        content: 'function createUser(data: UserData) { return db.insert(data) }',
        symbols: [],
      })

      const results = index.search('getUser')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].block.startLine).toBe(1)
    })
  })
})
