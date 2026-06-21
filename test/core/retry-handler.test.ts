import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldRetryEmptyResponse,
  shouldRetryThinkingStop,
  buildRetryPrompt,
  buildThinkingRetryPrompt,
  formatDiagnostics,
  buildEmptyResponseMessage,
} from '../../src/core/retry-handler.js'

describe('retry-handler', () => {
  describe('shouldRetryEmptyResponse', () => {
    test('空响应次数小于 2 时应该重试', () => {
      assert.equal(shouldRetryEmptyResponse({
        emptyResponseCount: 0,
        thinkingRetryCount: 0,
        toolErrorCount: 0,
        sawToolResult: false,
      }), true)
    })

    test('空响应次数等于 2 时不应该重试', () => {
      assert.equal(shouldRetryEmptyResponse({
        emptyResponseCount: 2,
        thinkingRetryCount: 0,
        toolErrorCount: 0,
        sawToolResult: false,
      }), false)
    })
  })

  describe('shouldRetryThinkingStop', () => {
    test('非空响应不应该重试', () => {
      assert.equal(shouldRetryThinkingStop({
        isEmpty: false,
        stopReason: 'pause_turn',
        blockTypes: ['thinking'],
      }), false)
    })

    test('pause_turn 且有 thinking 块应该重试', () => {
      assert.equal(shouldRetryThinkingStop({
        isEmpty: true,
        stopReason: 'pause_turn',
        blockTypes: ['thinking'],
      }), true)
    })

    test('max_tokens 且有 thinking 块应该重试', () => {
      assert.equal(shouldRetryThinkingStop({
        isEmpty: true,
        stopReason: 'max_tokens',
        blockTypes: ['thinking'],
      }), true)
    })

    test('end_turn 不应该重试', () => {
      assert.equal(shouldRetryThinkingStop({
        isEmpty: true,
        stopReason: 'end_turn',
        blockTypes: ['thinking'],
      }), false)
    })

    test('无 thinking 块不应该重试', () => {
      assert.equal(shouldRetryThinkingStop({
        isEmpty: true,
        stopReason: 'pause_turn',
        blockTypes: ['text'],
      }), false)
    })
  })

  describe('buildRetryPrompt', () => {
    test('max_tokens 时返回相应提示', () => {
      const prompt = buildRetryPrompt(false, 'max_tokens')
      assert.ok(prompt.includes('max_tokens'))
    })

    test('有工具结果时返回相应提示', () => {
      const prompt = buildRetryPrompt(true)
      assert.ok(prompt.includes('tool results'))
    })

    test('无工具结果时返回通用提示', () => {
      const prompt = buildRetryPrompt(false)
      assert.ok(prompt.includes('empty'))
    })
  })

  describe('buildThinkingRetryPrompt', () => {
    test('max_tokens 时返回相应提示', () => {
      const prompt = buildThinkingRetryPrompt('max_tokens')
      assert.ok(prompt.includes('max_tokens'))
    })

    test('其他情况返回通用提示', () => {
      const prompt = buildThinkingRetryPrompt('pause_turn')
      assert.ok(prompt.includes('pause_turn'))
    })
  })

  describe('formatDiagnostics', () => {
    test('格式化诊断信息', () => {
      const result = formatDiagnostics({
        stopReason: 'end_turn',
        blockTypes: ['text', 'tool_use'],
        ignoredBlockTypes: ['thinking'],
      })
      assert.ok(result.includes('stop_reason=end_turn'))
      assert.ok(result.includes('blocks=text,tool_use'))
      assert.ok(result.includes('ignored=thinking'))
    })

    test('空诊断信息返回空字符串', () => {
      const result = formatDiagnostics({})
      assert.equal(result, '')
    })
  })

  describe('buildEmptyResponseMessage', () => {
    test('有工具结果且有错误时返回相应消息', () => {
      const message = buildEmptyResponseMessage({
        sawToolResult: true,
        toolErrorCount: 2,
      })
      assert.ok(message.includes('2 个工具报错'))
    })

    test('有工具结果但无错误时返回相应消息', () => {
      const message = buildEmptyResponseMessage({
        sawToolResult: true,
        toolErrorCount: 0,
      })
      assert.ok(message.includes('工具执行后'))
    })

    test('无工具结果时返回通用消息', () => {
      const message = buildEmptyResponseMessage({
        sawToolResult: false,
        toolErrorCount: 0,
      })
      assert.ok(message.includes('模型返回空响应'))
    })
  })
})
