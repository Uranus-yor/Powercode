/**
 * 智能代码搜索模块类型定义
 */

/** 符号类型 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'interface'
  | 'type'
  | 'enum'
  | 'property'
  | 'parameter'

/** 符号定义 */
export interface Symbol {
  /** 符号名称 */
  name: string
  /** 符号类型 */
  kind: SymbolKind
  /** 所在文件路径 */
  file: string
  /** 起始行号（从 1 开始） */
  startLine: number
  /** 结束行号 */
  endLine: number
  /** 代码内容 */
  content: string
  /** 父符号名称（如方法所属的类） */
  parentName?: string
  /** 函数参数列表 */
  parameters?: string[]
  /** 导出类型 */
  exportKind?: 'default' | 'named' | 'none'
}

/** 符号引用 */
export interface Reference {
  /** 引用的符号名称 */
  symbolName: string
  /** 所在文件路径 */
  file: string
  /** 行号 */
  line: number
  /** 引用上下文 */
  context: string
}

/** 代码块 */
export interface CodeBlock {
  /** 所在文件路径 */
  file: string
  /** 起始行号 */
  startLine: number
  /** 结束行号 */
  endLine: number
  /** 代码内容 */
  content: string
  /** 包含的符号 */
  symbols: Symbol[]
  /** 嵌入向量（可选，由 embeddings 模块填充） */
  embedding?: number[]
}

/** 搜索结果 */
export interface SearchResult {
  /** 文件路径 */
  file: string
  /** 综合得分 */
  score: number
  /** 匹配的代码块 */
  blocks: CodeBlock[]
  /** 匹配原因 */
  reason: string
  /** BM25 得分 */
  bm25Score?: number
  /** 向量相似度得分 */
  embeddingScore?: number
}

/** 索引元数据 */
export interface IndexMetadata {
  /** 索引格式版本 */
  version: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 文件数量 */
  fileCount: number
  /** 符号数量 */
  symbolCount: number
  /** 项目根目录 */
  projectRoot: string
}

/** 索引数据（完整） */
export interface CodeIndex {
  /** 元数据 */
  metadata: IndexMetadata
  /** 符号表：key 为 符号名称 */
  symbols: Map<string, Symbol[]>
  /** 引用表：key 为 符号名称 */
  references: Map<string, Reference[]>
  /** 代码块列表 */
  blocks: CodeBlock[]
  /** 文件列表 */
  files: string[]
}

/** 索引配置 */
export interface IndexConfig {
  /** 支持的文件扩展名 */
  extensions?: string[]
  /** 忽略的目录 */
  ignoreDirs?: string[]
  /** 最大文件大小（字节） */
  maxFileSize?: number
  /** 嵌入向量维度 */
  embeddingDimension?: number
}

/** 默认配置 */
export const DEFAULT_INDEX_CONFIG: IndexConfig = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  ignoreDirs: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.powercode',
    'coverage',
    '.next',
  ],
  maxFileSize: 100 * 1024, // 100KB
  embeddingDimension: 256,
}
