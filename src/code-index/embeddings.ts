/**
 * 嵌入向量生成模块
 * 使用 ONNX Runtime 加载 potion-code-16M 模型
 */

import * as ort from 'onnxruntime-node'
import fs from 'fs'
import path from 'path'

/** 嵌入向量维度 */
const EMBEDDING_DIMENSION = 256

/** 模型路径 */
const MODEL_DIR = path.join(__dirname, 'models')
const MODEL_FILE = 'potion-code-16M.onnx'
const MODEL_PATH = path.join(MODEL_DIR, MODEL_FILE)

/** 嵌入缓存 */
const embeddingCache = new Map<string, number[]>()

/** 模型会话 */
let session: ort.InferenceSession | null = null

/** 初始化模型 */
export async function initModel(): Promise<boolean> {
  if (session) return true

  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.warn(`模型文件不存在: ${MODEL_PATH}`)
      return false
    }

    session = await ort.InferenceSession.create(MODEL_PATH)
    return true
  } catch (error) {
    console.error('初始化嵌入模型失败:', error)
    return false
  }
}

/** 检查模型是否已加载 */
export function isModelLoaded(): boolean {
  return session !== null
}

/** 生成单个文本的嵌入向量 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  // 检查缓存
  const cacheKey = text.trim()
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!
  }

  // 初始化模型
  if (!session) {
    const initialized = await initModel()
    if (!initialized) return null
  }

  try {
    // 简单的文本预处理
    const processed = preprocessText(text)

    // 创建输入张量（简化处理，实际需要 tokenizer）
    const inputTensor = createInputTensor(processed)

    // 运行推理
    const results = await session!.run({ input: inputTensor })
    const output = results.output as ort.Tensor

    // 提取向量
    const embedding = Array.from(output.data as Float32Array)

    // 缓存结果
    embeddingCache.set(cacheKey, embedding)

    return embedding
  } catch (error) {
    console.error('生成嵌入向量失败:', error)
    return null
  }
}

/** 批量生成嵌入向量 */
export async function getEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []

  // 检查缓存
  const uncachedIndices: number[] = []
  const uncachedTexts: string[] = []

  for (let i = 0; i < texts.length; i++) {
    const cacheKey = texts[i].trim()
    if (embeddingCache.has(cacheKey)) {
      results.push(embeddingCache.get(cacheKey)!)
    } else {
      results.push(null)
      uncachedIndices.push(i)
      uncachedTexts.push(texts[i])
    }
  }

  // 如果所有都命中缓存，直接返回
  if (uncachedTexts.length === 0) {
    return results
  }

  // 初始化模型
  if (!session) {
    const initialized = await initModel()
    if (!initialized) return results
  }

  // 批量处理未缓存的文本
  for (let i = 0; i < uncachedTexts.length; i++) {
    const embedding = await getEmbedding(uncachedTexts[i])
    results[uncachedIndices[i]] = embedding
  }

  return results
}

/** 计算两个向量的余弦相似度 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** 清空缓存 */
export function clearCache(): void {
  embeddingCache.clear()
}

/** 获取缓存大小 */
export function getCacheSize(): number {
  return embeddingCache.size
}

/** 文本预处理 */
function preprocessText(text: string): string {
  // 移除多余空白
  let processed = text.replace(/\s+/g, ' ').trim()

  // 截断过长的文本（简化处理）
  if (processed.length > 512) {
    processed = processed.substring(0, 512)
  }

  return processed
}

/** 创建输入张量（简化版本，实际需要完整的 tokenizer） */
function createInputTensor(text: string): ort.Tensor {
  // 简化处理：将文本转换为字符编码
  // 实际应该使用模型的 tokenizer
  const maxLen = 128
  const ids = new BigInt64Array(maxLen)

  for (let i = 0; i < Math.min(text.length, maxLen); i++) {
    ids[i] = BigInt(text.charCodeAt(i))
  }

  return new ort.Tensor('int64', ids, [1, maxLen])
}

/** 导出模型配置 */
export const MODEL_CONFIG = {
  dimension: EMBEDDING_DIMENSION,
  maxLength: 512,
  modelPath: MODEL_PATH,
}
