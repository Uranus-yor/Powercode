import { describe, test, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProgressContinuationPrompt,
  isProgressUpdate,
} from '../../src/core/progress-handler.js'

describe('progress-handler', () => {
  describe('buildProgressContinuationPrompt', () => {
    test('有工具结果时返回相应提示', () => {
      const prompt = buildProgressContinuationPrompt(true)
      assert.ok(prompt.includes('progress update'))
      assert.ok(prompt.includes('tools in this turn'))
    })

    test('无工具结果时返回通用提示', () => {
      const prompt = buildProgressContinuationPrompt(false)
      assert.ok(prompt.includes('<progress>'))
    })
  })

  describe('isProgressUpdate', () => {
    test('kind 为 progress 时返回 true', () => {
      assert.equal(isProgressUpdate({
        kind: 'progress',
        content: 'working...',
        sawToolResultThisTurn: false,
      }), true)
    })

    test('kind 为 final 时返回 false', () => {
      assert.equal(isProgressUpdate({
        kind: 'final',
        content: 'done',
        sawToolResultThisTurn: false,
      }), false)
    })

    test('无 kind 且无工具结果时返回 false', () => {
      assert.equal(isProgressUpdate({
        content: 'working...',
        sawToolResultThisTurn: false,
      }), false)
    })
  })
})
