import { describe, it, expect } from 'vitest'

describe('智能代码搜索依赖验证', () => {
  it('tree-sitter 可以导入', async () => {
    const Parser = await import('tree-sitter')
    expect(Parser).toBeDefined()
    expect(typeof Parser.default).toBe('function')
  })

  it('tree-sitter-typescript 可以导入', async () => {
    const TypeScript = await import('tree-sitter-typescript')
    expect(TypeScript).toBeDefined()
    expect(TypeScript.typescript).toBeDefined()
    expect(TypeScript.tsx).toBeDefined()
  })

  it('tree-sitter-javascript 可以导入', async () => {
    const JavaScript = await import('tree-sitter-javascript')
    expect(JavaScript).toBeDefined()
  })

  it('onnxruntime-node 可以导入', async () => {
    const ort = await import('onnxruntime-node')
    expect(ort).toBeDefined()
    expect(ort.InferenceSession).toBeDefined()
  })

  it('tree-sitter 能解析 TypeScript 代码', async () => {
    const Parser = (await import('tree-sitter')).default
    const { typescript: TypeScript } = await import('tree-sitter-typescript')

    const parser = new Parser()
    parser.setLanguage(TypeScript)

    const code = `
function greet(name: string): string {
  return "Hello, " + name;
}

class UserService {
  getUser(id: number) {
    return { id, name: "test" };
  }
}
`
    const tree = parser.parse(code)
    expect(tree).toBeDefined()
    expect(tree.rootNode).toBeDefined()
    expect(tree.rootNode.type).toBe('program')

    // 验证能提取函数定义
    const functions = findAllNodes(tree.rootNode, 'function_declaration')
    expect(functions.length).toBe(1)
    expect(functions[0].text).toContain('greet')

    // 验证能提取类定义
    const classes = findAllNodes(tree.rootNode, 'class_declaration')
    expect(classes.length).toBe(1)
    expect(classes[0].text).toContain('UserService')
  })

  it('tree-sitter 能解析 JavaScript 代码', async () => {
    const Parser = (await import('tree-sitter')).default
    const JavaScript = (await import('tree-sitter-javascript')).default

    const parser = new Parser()
    parser.setLanguage(JavaScript)

    const code = `
function add(a, b) {
  return a + b;
}

const multiply = (a, b) => a * b;
`
    const tree = parser.parse(code)
    expect(tree).toBeDefined()
    expect(tree.rootNode.type).toBe('program')

    const functions = findAllNodes(tree.rootNode, 'function_declaration')
    expect(functions.length).toBe(1)
    expect(functions[0].text).toContain('add')
  })
})

function findAllNodes(node: any, type: string): any[] {
  const results: any[] = []
  if (node.type === type) {
    results.push(node)
  }
  for (let i = 0; i < node.childCount; i++) {
    results.push(...findAllNodes(node.child(i), type))
  }
  return results
}
