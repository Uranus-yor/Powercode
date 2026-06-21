/**
 * tree-sitter 代码解析器
 * 提取函数、类、变量等符号定义
 */

import Parser from 'tree-sitter'
import TypeScript from 'tree-sitter-typescript'
import JavaScript from 'tree-sitter-javascript'
import { Symbol, SymbolKind, CodeBlock } from './types.js'

/** 语言映射 */
const LANGUAGES: Record<string, any> = {
  '.ts': TypeScript.typescript,
  '.tsx': TypeScript.tsx,
  '.js': JavaScript,
  '.jsx': JavaScript,
  '.mjs': JavaScript,
  '.cjs': JavaScript,
}

/** 解析结果 */
export interface ParseResult {
  /** 符号列表 */
  symbols: Symbol[]
  /** 代码块列表 */
  blocks: CodeBlock[]
}

/** 获取文件对应的语言 */
export function getLanguage(filePath: string): any {
  const ext = getExtension(filePath)
  return LANGUAGES[ext] || null
}

/** 获取文件扩展名 */
function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot >= 0 ? filePath.slice(lastDot) : ''
}

/** 解析文件内容 */
export function parseCode(filePath: string, code: string): ParseResult {
  const language = getLanguage(filePath)
  if (!language) {
    return { symbols: [], blocks: [] }
  }

  const parser = new Parser()
  parser.setLanguage(language)

  const tree = parser.parse(code)
  const symbols: Symbol[] = []
  const blocks: CodeBlock[] = []

  // 提取符号
  extractSymbols(tree.rootNode, filePath, code, symbols)

  // 基于符号创建代码块
  for (const symbol of symbols) {
    const block: CodeBlock = {
      file: filePath,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      content: symbol.content,
      symbols: [symbol],
    }
    blocks.push(block)
  }

  return { symbols, blocks }
}

/** 提取符号定义 */
function extractSymbols(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  symbols: Symbol[],
  parentName?: string
): void {
  const nodeType = node.type

  switch (nodeType) {
    case 'function_declaration':
      symbols.push(extractFunction(node, filePath, code, parentName))
      break

    case 'class_declaration':
      const classSymbol = extractClass(node, filePath, code)
      symbols.push(classSymbol)
      // 递归提取类成员
      extractClassMembers(node, filePath, code, classSymbol.name, symbols)
      break

    case 'interface_declaration':
      symbols.push(extractInterface(node, filePath, code))
      break

    case 'type_alias_declaration':
      symbols.push(extractTypeAlias(node, filePath, code))
      break

    case 'enum_declaration':
      symbols.push(extractEnum(node, filePath, code))
      break

    case 'variable_declaration':
      extractVariableDeclaration(node, filePath, code, symbols, parentName)
      break

    case 'lexical_declaration':
      extractLexicalDeclaration(node, filePath, code, symbols, parentName)
      break

    case 'export_statement':
      // 处理导出声明
      extractExport(node, filePath, code, symbols)
      break

    case 'method_definition':
      symbols.push(extractMethod(node, filePath, code, parentName))
      break
  }

  // 递归处理子节点（跳过已处理的类内部）
  if (nodeType !== 'class_declaration') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child) {
        extractSymbols(child, filePath, code, symbols, parentName)
      }
    }
  }
}

/** 提取函数定义 */
function extractFunction(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  parentName?: string
): Symbol {
  const nameNode = findChild(node, 'identifier')
  const name = nameNode?.text || 'anonymous'
  const parameters = extractParameters(node)

  return {
    name,
    kind: 'function',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    parentName,
    parameters,
    exportKind: 'none',
  }
}

/** 提取类定义 */
function extractClass(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string
): Symbol {
  const nameNode = findChild(node, 'identifier') || findChild(node, 'type_identifier')
  const name = nameNode?.text || 'Anonymous'

  return {
    name,
    kind: 'class',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    exportKind: 'none',
  }
}

/** 提取类成员 */
function extractClassMembers(
  classNode: Parser.SyntaxNode,
  filePath: string,
  code: string,
  className: string,
  symbols: Symbol[]
): void {
  const body = findChild(classNode, 'class_body')
  if (!body) return

  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i)
    if (!child) continue

    if (child.type === 'method_definition') {
      symbols.push(extractMethod(child, filePath, code, className))
    } else if (child.type === 'public_field_definition') {
      symbols.push(extractProperty(child, filePath, code, className))
    }
  }
}

/** 提取方法定义 */
function extractMethod(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  parentName?: string
): Symbol {
  const nameNode = findChild(node, 'property_identifier') || findChild(node, 'identifier')
  const name = nameNode?.text || 'anonymous'
  const parameters = extractParameters(node)

  return {
    name,
    kind: 'method',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    parentName,
    parameters,
  }
}

/** 提取属性定义 */
function extractProperty(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  parentName?: string
): Symbol {
  const nameNode = findChild(node, 'property_identifier') || findChild(node, 'identifier')
  const name = nameNode?.text || 'unknown'

  return {
    name,
    kind: 'property',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    parentName,
  }
}

/** 提取接口定义 */
function extractInterface(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string
): Symbol {
  const nameNode = findChild(node, 'identifier') || findChild(node, 'type_identifier')
  const name = nameNode?.text || 'Anonymous'

  return {
    name,
    kind: 'interface',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    exportKind: 'none',
  }
}

/** 提取类型别名 */
function extractTypeAlias(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string
): Symbol {
  const nameNode = findChild(node, 'identifier') || findChild(node, 'type_identifier')
  const name = nameNode?.text || 'Anonymous'

  return {
    name,
    kind: 'type',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    exportKind: 'none',
  }
}

/** 提取枚举定义 */
function extractEnum(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string
): Symbol {
  const nameNode = findChild(node, 'identifier')
  const name = nameNode?.text || 'Anonymous'

  return {
    name,
    kind: 'enum',
    file: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    content: node.text,
    exportKind: 'none',
  }
}

/** 提取变量声明 */
function extractVariableDeclaration(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  symbols: Symbol[],
  parentName?: string
): void {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || child.type !== 'variable_declarator') continue

    const nameNode = findChild(child, 'identifier')
    if (!nameNode) continue

    symbols.push({
      name: nameNode.text,
      kind: 'variable',
      file: filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      content: node.text,
      parentName,
    })
  }
}

/** 提取词法声明（const/let） */
function extractLexicalDeclaration(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  symbols: Symbol[],
  parentName?: string
): void {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child || child.type !== 'variable_declarator') continue

    const nameNode = findChild(child, 'identifier')
    if (!nameNode) continue

    // 检查是否是箭头函数
    const valueNode = child.child(child.childCount - 1)
    const isArrowFunction = valueNode?.type === 'arrow_function'

    symbols.push({
      name: nameNode.text,
      kind: isArrowFunction ? 'function' : 'variable',
      file: filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      content: node.text,
      parentName,
    })
  }
}

/** 提取导出声明 */
function extractExport(
  node: Parser.SyntaxNode,
  filePath: string,
  code: string,
  symbols: Symbol[]
): void {
  // 递归处理导出的内容
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child) continue

    if (
      child.type === 'function_declaration' ||
      child.type === 'class_declaration' ||
      child.type === 'interface_declaration' ||
      child.type === 'type_alias_declaration' ||
      child.type === 'enum_declaration' ||
      child.type === 'variable_declaration' ||
      child.type === 'lexical_declaration'
    ) {
      extractSymbols(child, filePath, code, symbols)
      // 标记为导出
      const lastSymbol = symbols[symbols.length - 1]
      if (lastSymbol) {
        const isDefault = node.text.includes('default')
        lastSymbol.exportKind = isDefault ? 'default' : 'named'
      }
    }
  }
}

/** 提取函数参数 */
function extractParameters(node: Parser.SyntaxNode): string[] {
  const params: string[] = []
  const formalParams = findChild(node, 'formal_parameters')
  if (!formalParams) return params

  for (let i = 0; i < formalParams.childCount; i++) {
    const child = formalParams.child(i)
    if (!child) continue

    if (child.type === 'identifier' || child.type === 'required_parameter') {
      const nameNode = child.type === 'required_parameter'
        ? findChild(child, 'identifier')
        : child
      if (nameNode) {
        params.push(nameNode.text)
      }
    }
  }

  return params
}

/** 查找指定类型的子节点 */
function findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && child.type === type) {
      return child
    }
  }
  return null
}
