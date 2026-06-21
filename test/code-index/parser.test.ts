import { describe, it, expect } from 'vitest'
import { parseCode, getLanguage } from '../../src/code-index/parser.js'

describe('tree-sitter 代码解析器', () => {
  describe('getLanguage', () => {
    it('返回 TypeScript 语言', () => {
      expect(getLanguage('test.ts')).toBeDefined()
      expect(getLanguage('test.tsx')).toBeDefined()
    })

    it('返回 JavaScript 语言', () => {
      expect(getLanguage('test.js')).toBeDefined()
      expect(getLanguage('test.jsx')).toBeDefined()
      expect(getLanguage('test.mjs')).toBeDefined()
      expect(getLanguage('test.cjs')).toBeDefined()
    })

    it('未知扩展名返回 null', () => {
      expect(getLanguage('test.py')).toBeNull()
      expect(getLanguage('test.java')).toBeNull()
    })
  })

  describe('parseCode - TypeScript', () => {
    it('提取函数定义', () => {
      const code = `
function greet(name: string): string {
  return "Hello, " + name;
}
`
      const result = parseCode('test.ts', code)
      expect(result.symbols).toHaveLength(1)
      expect(result.symbols[0].name).toBe('greet')
      expect(result.symbols[0].kind).toBe('function')
      expect(result.symbols[0].parameters).toEqual(['name'])
    })

    it('提取类定义和方法', () => {
      const code = `
class UserService {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  getUser(id: number) {
    return { id, name: this.name };
  }
}
`
      const result = parseCode('test.ts', code)
      const classNames = result.symbols.filter(s => s.kind === 'class')
      const methods = result.symbols.filter(s => s.kind === 'method')

      expect(classNames).toHaveLength(1)
      expect(classNames[0].name).toBe('UserService')

      // constructor + getUser
      expect(methods.length).toBeGreaterThanOrEqual(2)
    })

    it('提取接口定义', () => {
      const code = `
interface User {
  id: number;
  name: string;
  email: string;
}
`
      const result = parseCode('test.ts', code)
      expect(result.symbols).toHaveLength(1)
      expect(result.symbols[0].name).toBe('User')
      expect(result.symbols[0].kind).toBe('interface')
    })

    it('提取类型别名', () => {
      const code = `
type UserID = string | number;
`
      const result = parseCode('test.ts', code)
      expect(result.symbols).toHaveLength(1)
      expect(result.symbols[0].name).toBe('UserID')
      expect(result.symbols[0].kind).toBe('type')
    })

    it('提取枚举定义', () => {
      const code = `
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}
`
      const result = parseCode('test.ts', code)
      expect(result.symbols).toHaveLength(1)
      expect(result.symbols[0].name).toBe('Status')
      expect(result.symbols[0].kind).toBe('enum')
    })

    it('提取 const 箭头函数', () => {
      const code = `
const add = (a: number, b: number) => a + b;
`
      const result = parseCode('test.ts', code)
      expect(result.symbols).toHaveLength(1)
      expect(result.symbols[0].name).toBe('add')
      expect(result.symbols[0].kind).toBe('function')
    })

    it('提取变量声明', () => {
      const code = `
let count = 0;
const name = "test";
`
      const result = parseCode('test.ts', code)
      expect(result.symbols.length).toBeGreaterThanOrEqual(2)
      const names = result.symbols.map(s => s.name)
      expect(names).toContain('count')
      expect(names).toContain('name')
    })

    it('提取导出函数', () => {
      const code = `
export function publicFunc() {}
export default function defaultFunc() {}
`
      const result = parseCode('test.ts', code)
      expect(result.symbols.length).toBeGreaterThanOrEqual(2)

      const publicFunc = result.symbols.find(s => s.name === 'publicFunc')
      const defaultFunc = result.symbols.find(s => s.name === 'defaultFunc')

      expect(publicFunc?.exportKind).toBe('named')
      expect(defaultFunc?.exportKind).toBe('default')
    })

    it('生成代码块', () => {
      const code = `
function foo() {
  return 1;
}

function bar() {
  return 2;
}
`
      const result = parseCode('test.ts', code)
      expect(result.blocks).toHaveLength(2)
      expect(result.blocks[0].file).toBe('test.ts')
    })
  })

  describe('parseCode - JavaScript', () => {
    it('提取函数定义', () => {
      const code = `
function hello(name) {
  return "Hello, " + name;
}
`
      const result = parseCode('test.js', code)
      expect(result.symbols).toHaveLength(1)
      expect(result.symbols[0].name).toBe('hello')
      expect(result.symbols[0].kind).toBe('function')
    })

    it('提取类定义', () => {
      const code = `
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return this.name + ' makes a noise.';
  }
}
`
      const result = parseCode('test.js', code)
      const classes = result.symbols.filter(s => s.kind === 'class')
      expect(classes).toHaveLength(1)
      expect(classes[0].name).toBe('Animal')
    })
  })

  describe('边界情况', () => {
    it('空文件返回空结果', () => {
      const result = parseCode('test.ts', '')
      expect(result.symbols).toEqual([])
      expect(result.blocks).toEqual([])
    })

    it('未知文件类型返回空结果', () => {
      const result = parseCode('test.py', 'print("hello")')
      expect(result.symbols).toEqual([])
      expect(result.blocks).toEqual([])
    })

    it('正确计算行号', () => {
      const code = `
// 第1行
// 第2行
function test() {
  return 1;
}
`
      const result = parseCode('test.ts', code)
      expect(result.symbols[0].startLine).toBe(4)
    })
  })
})
