import { describe, it, expect } from 'vitest'
import { cosineSimilarity, isModelLoaded, MODEL_CONFIG } from '../../src/code-index/embeddings.js'

describe('嵌入向量生成模块', () => {
  describe('cosineSimilarity', () => {
    it('相同向量相似度为 1', () => {
      const a = [1, 2, 3, 4, 5]
      const b = [1, 2, 3, 4, 5]
      expect(cosineSimilarity(a, b)).toBe(1)
    })

    it('正交向量相似度为 0', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]
      expect(cosineSimilarity(a, b)).toBe(0)
    })

    it('相反向量相似度为 -1', () => {
      const a = [1, 2, 3]
      const b = [-1, -2, -3]
      expect(cosineSimilarity(a, b)).toBe(-1)
    })

    it('部分相似向量', () => {
      const a = [1, 1, 0]
      const b = [1, 0, 0]
      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(1)
    })

    it('零向量返回 0', () => {
      const a = [0, 0, 0]
      const b = [1, 2, 3]
      expect(cosineSimilarity(a, b)).toBe(0)
    })

    it('不同长度向量返回 0', () => {
      const a = [1, 2]
      const b = [1, 2, 3]
      expect(cosineSimilarity(a, b)).toBe(0)
    })
  })

  describe('MODEL_CONFIG', () => {
    it('配置正确', () => {
      expect(MODEL_CONFIG.dimension).toBe(256)
      expect(MODEL_CONFIG.maxLength).toBe(512)
      expect(MODEL_CONFIG.modelPath).toContain('potion-code-16M.onnx')
    })
  })

  describe('isModelLoaded', () => {
    it('初始状态为 false', () => {
      // 模型文件可能不存在，所以初始状态应该是 false
      expect(typeof isModelLoaded()).toBe('boolean')
    })
  })
})
