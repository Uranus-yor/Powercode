/**
 * 搜索引擎
 * 实现 Reciprocal Rank Fusion 融合和代码感知重排
 */

import { CodeIndex, Symbol, CodeBlock, SearchResult } from './types.js'
import { SymbolBM25Index, CodeBlockBM25Index } from './bm25.js'

/** 搜索配置 */
export interface SearchConfig {
  /** BM25 权重 */
  bm25Weight?: number
  /** 嵌入向量权重 */
  embeddingWeight?: number
  /** 返回结果数量 */
  limit?: number
  /** Reciprocal Rank Fusion 参数 k */
  rrfK?: number
}

/** 默认搜索配置 */
const DEFAULT_CONFIG: SearchConfig = {
  bm25Weight: 0.6,
  embeddingWeight: 0.4,
  limit: 10,
  rrfK: 60,
}

/** 搜索引擎 */
export class SearchEngine {
  private symbolIndex: SymbolBM25Index
  private blockIndex: CodeBlockBM25Index
  private index: CodeIndex

  constructor(index: CodeIndex) {
    this.index = index
    this.symbolIndex = new SymbolBM25Index()
    this.blockIndex = new CodeBlockBM25Index()

    // 构建索引
    this.buildIndexes()
  }

  /** 构建搜索索引 */
  private buildIndexes(): void {
    // 添加符号到 BM25 索引
    for (const symbols of this.index.symbols.values()) {
      this.symbolIndex.addSymbols(symbols)
    }

    // 添加代码块到 BM25 索引
    this.blockIndex.addBlocks(this.index.blocks)
  }

  /** 搜索 */
  async search(
    query: string,
    config: SearchConfig = DEFAULT_CONFIG
  ): Promise<SearchResult[]> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }

    // BM25 搜索
    const symbolResults = this.symbolIndex.search(query, mergedConfig.limit! * 2)
    const blockResults = this.blockIndex.search(query, mergedConfig.limit! * 2)

    // 转换为统一格式
    const bm25Ranked = this.convertToSearchResults(symbolResults, blockResults)

    // 如果有嵌入向量，进行融合
    // TODO: 实现嵌入向量搜索

    // 代码感知重排
    const reranked = this.rerank(bm25Ranked, query)

    // 去重和限制数量
    const deduplicated = this.deduplicate(reranked)

    return deduplicated.slice(0, mergedConfig.limit)
  }

  /** 转换 BM25 结果为搜索结果 */
  private convertToSearchResults(
    symbolResults: Array<{ symbol: Symbol; score: number }>,
    blockResults: Array<{ block: CodeBlock; score: number }>
  ): SearchResult[] {
    const results: SearchResult[] = []

    // 按文件分组符号结果
    const fileSymbolMap = new Map<string, Array<{ symbol: Symbol; score: number }>>()
    for (const result of symbolResults) {
      const file = result.symbol.file
      const existing = fileSymbolMap.get(file) || []
      existing.push(result)
      fileSymbolMap.set(file, existing)
    }

    // 创建搜索结果
    for (const [file, symbols] of fileSymbolMap) {
      const blocks: CodeBlock[] = symbols.map(s => ({
        file: s.symbol.file,
        startLine: s.symbol.startLine,
        endLine: s.symbol.endLine,
        content: s.symbol.content,
        symbols: [s.symbol],
      }))

      const maxScore = Math.max(...symbols.map(s => s.score))

      results.push({
        file,
        score: maxScore,
        blocks,
        reason: `匹配到 ${symbols.length} 个符号`,
        bm25Score: maxScore,
      })
    }

    // 添加代码块结果
    for (const result of blockResults) {
      const existing = results.find(r => r.file === result.block.file)
      if (existing) {
        existing.blocks.push(result.block)
        existing.score = Math.max(existing.score, result.score)
      } else {
        results.push({
          file: result.block.file,
          score: result.score,
          blocks: [result.block],
          reason: '匹配到代码块',
          bm25Score: result.score,
        })
      }
    }

    return results
  }

  /** Reciprocal Rank Fusion */
  rrfFuse(
    rankings: Array<Array<{ id: string; score: number }>>,
    k: number = 60
  ): Array<{ id: string; score: number }> {
    const scores = new Map<string, number>()

    for (const ranking of rankings) {
      for (let i = 0; i < ranking.length; i++) {
        const item = ranking[i]
        const rrfScore = 1 / (k + i + 1)
        scores.set(item.id, (scores.get(item.id) || 0) + rrfScore)
      }
    }

    // 转换为数组并排序
    const results = Array.from(scores.entries()).map(([id, score]) => ({
      id,
      score,
    }))

    results.sort((a, b) => b.score - a.score)

    return results
  }

  /** 代码感知重排 */
  private rerank(results: SearchResult[], query: string): SearchResult[] {
    return results.map(result => {
      let boost = 1.0
      const reasons: string[] = []

      // 1. 定义优先
      const hasDefinition = result.blocks.some(block =>
        block.symbols.some(
          s =>
            s.kind === 'function' ||
            s.kind === 'class' ||
            s.kind === 'interface'
        )
      )
      if (hasDefinition) {
        boost *= 1.2
        reasons.push('定义优先')
      }

      // 2. 测试文件降权
      if (result.file.includes('test') || result.file.includes('spec')) {
        boost *= 0.7
        reasons.push('测试文件降权')
      }

      // 3. 文件内聚性（多个符号在同一文件）
      const uniqueSymbols = new Set(
        result.blocks.flatMap(b => b.symbols.map(s => s.name))
      )
      if (uniqueSymbols.size > 1) {
        boost *= 1.1
        reasons.push('文件内聚性')
      }

      // 4. 导出符号优先
      const hasExport = result.blocks.some(block =>
        block.symbols.some(s => s.exportKind === 'named' || s.exportKind === 'default')
      )
      if (hasExport) {
        boost *= 1.1
        reasons.push('导出符号优先')
      }

      // 5. 查询匹配度（符号名称与查询的相似度）
      const queryLower = query.toLowerCase()
      const symbolNames = result.blocks.flatMap(b => b.symbols.map(s => s.name.toLowerCase()))
      const nameMatch = symbolNames.some(name => name.includes(queryLower) || queryLower.includes(name))
      if (nameMatch) {
        boost *= 1.3
        reasons.push('名称匹配')
      }

      return {
        ...result,
        score: result.score * boost,
        reason: reasons.join(', ') || result.reason,
      }
    }).sort((a, b) => b.score - a.score)
  }

  /** 去重 */
  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()

    return results.filter(result => {
      // 基于文件路径和代码块起始行去重
      const key = result.blocks
        .map(b => `${b.file}:${b.startLine}`)
        .join(',')

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  }
}

/** 创建搜索引擎 */
export function createSearchEngine(index: CodeIndex): SearchEngine {
  return new SearchEngine(index)
}
