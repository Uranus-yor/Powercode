/**
 * BM25 搜索实现
 * 支持标识符匹配（驼峰命名、下划线命名分词）
 */

import { Symbol, CodeBlock } from './types.js'

/** BM25 参数 */
const BM25_K1 = 1.2
const BM25_B = 0.75

/** 分词结果 */
interface Token {
  text: string
  position: number
}

/** 文档统计 */
interface DocStats {
  termFreq: Map<string, number>
  docLength: number
}

/** BM25 索引 */
export class BM25Index {
  private documents: Map<string, DocStats> = new Map()
  private docCount: number = 0
  private avgDocLength: number = 0
  private idfCache: Map<string, number> = new Map()

  /** 添加文档到索引 */
  addDocument(id: string, text: string): void {
    const tokens = tokenize(text)
    const termFreq = new Map<string, number>()

    for (const token of tokens) {
      const count = termFreq.get(token.text) || 0
      termFreq.set(token.text, count + 1)
    }

    this.documents.set(id, {
      termFreq,
      docLength: tokens.length,
    })

    this.docCount++
    this.avgDocLength =
      Array.from(this.documents.values()).reduce(
        (sum, doc) => sum + doc.docLength,
        0
      ) / this.docCount

    // 清除 IDF 缓存
    this.idfCache.clear()
  }

  /** 计算 IDF（逆文档频率） */
  private calcIDF(term: string): number {
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!
    }

    let docsWithTerm = 0
    for (const doc of this.documents.values()) {
      if (doc.termFreq.has(term)) {
        docsWithTerm++
      }
    }

    // BM25 IDF 公式
    const idf =
      Math.log(
        (this.docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1
      )

    this.idfCache.set(term, idf)
    return idf
  }

  /** 计算单个文档的 BM25 得分 */
  private calcDocScore(queryTokens: string[], docId: string): number {
    const doc = this.documents.get(docId)
    if (!doc) return 0

    let score = 0
    for (const term of queryTokens) {
      const tf = doc.termFreq.get(term) || 0
      if (tf === 0) continue

      const idf = this.calcIDF(term)
      const tfNorm =
        (tf * (BM25_K1 + 1)) /
        (tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.docLength / this.avgDocLength)))

      score += idf * tfNorm
    }

    return score
  }

  /** 搜索 */
  search(query: string, topK: number = 10): Array<{ id: string; score: number }> {
    const queryTokens = tokenize(query).map(t => t.text)
    if (queryTokens.length === 0) return []

    const scores: Array<{ id: string; score: number }> = []

    for (const docId of this.documents.keys()) {
      const score = this.calcDocScore(queryTokens, docId)
      if (score > 0) {
        scores.push({ id: docId, score })
      }
    }

    // 按得分降序排序
    scores.sort((a, b) => b.score - a.score)

    return scores.slice(0, topK)
  }

  /** 清空索引 */
  clear(): void {
    this.documents.clear()
    this.docCount = 0
    this.avgDocLength = 0
    this.idfCache.clear()
  }
}

/** 符号 BM25 索引 */
export class SymbolBM25Index {
  private index: BM25Index = new BM25Index()
  private symbolMap: Map<string, Symbol[]> = new Map()

  /** 添加符号 */
  addSymbol(symbol: Symbol): void {
    // 索引符号名称和内容
    const searchText = `${symbol.name} ${symbol.content}`
    this.index.addDocument(symbol.name, searchText)

    const existing = this.symbolMap.get(symbol.name) || []
    existing.push(symbol)
    this.symbolMap.set(symbol.name, existing)
  }

  /** 批量添加符号 */
  addSymbols(symbols: Symbol[]): void {
    for (const symbol of symbols) {
      this.addSymbol(symbol)
    }
  }

  /** 搜索符号 */
  search(query: string, topK: number = 10): Array<{ symbol: Symbol; score: number }> {
    const results = this.index.search(query, topK)
    const symbolResults: Array<{ symbol: Symbol; score: number }> = []

    for (const result of results) {
      const symbols = this.symbolMap.get(result.id) || []
      for (const symbol of symbols) {
        symbolResults.push({ symbol, score: result.score })
      }
    }

    // 按得分降序排序
    symbolResults.sort((a, b) => b.score - a.score)

    return symbolResults.slice(0, topK)
  }

  /** 清空索引 */
  clear(): void {
    this.index.clear()
    this.symbolMap.clear()
  }
}

/** 代码块 BM25 索引 */
export class CodeBlockBM25Index {
  private index: BM25Index = new BM25Index()
  private blockMap: Map<string, CodeBlock> = new Map()

  /** 添加代码块 */
  addBlock(block: CodeBlock): void {
    const id = `${block.file}:${block.startLine}`
    const searchText = block.content
    this.index.addDocument(id, searchText)
    this.blockMap.set(id, block)
  }

  /** 批量添加代码块 */
  addBlocks(blocks: CodeBlock[]): void {
    for (const block of blocks) {
      this.addBlock(block)
    }
  }

  /** 搜索代码块 */
  search(query: string, topK: number = 10): Array<{ block: CodeBlock; score: number }> {
    const results = this.index.search(query, topK)
    return results
      .map(r => ({
        block: this.blockMap.get(r.id)!,
        score: r.score,
      }))
      .filter(r => r.block)
  }

  /** 清空索引 */
  clear(): void {
    this.index.clear()
    this.blockMap.clear()
  }
}

/** 分词器 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let position = 0

  // 按空白和标点分割
  const words = text.split(/[\s\p{P}]+/u).filter(w => w.length > 0)

  for (const word of words) {
    // 检查是否包含下划线（蛇形命名）
    if (word.includes('_')) {
      // 下划线命名分词
      const snakeTokens = word.split('_').filter(t => t.length > 0)
      for (const token of snakeTokens) {
        tokens.push({
          text: token.toLowerCase(),
          position: position++,
        })
      }
    } else {
      // 驼峰命名分词
      const camelTokens = splitCamelCase(word)
      for (const token of camelTokens) {
        tokens.push({
          text: token.toLowerCase(),
          position: position++,
        })
      }
    }
  }

  return tokens
}

/** 驼峰命名分词 */
function splitCamelCase(word: string): string[] {
  const tokens: string[] = []
  let current = ''

  for (let i = 0; i < word.length; i++) {
    const char = word[i]

    if (char >= 'A' && char <= 'Z') {
      if (current.length > 0) {
        tokens.push(current)
      }
      current = char.toLowerCase()
    } else {
      current += char
    }
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}
