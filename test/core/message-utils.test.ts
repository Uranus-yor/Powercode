import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEmptyAssistantResponse,
  isProgressMessage,
  isFinalMessage,
  extractMessageKind,
  parseAssistantText,
} from '../../src/core/message-utils.js'

describe('message-utils', () => {
  describe('isEmptyAssistantResponse', () => {
    test('空字符串返回 true', () => {
      assert.equal(isEmptyAssistantResponse(''), true)
    })

    test('只有空格返回 true', () => {
      assert.equal(isEmptyAssistantResponse('   '), true)
    })

    test('有内容返回 false', () => {
      assert.equal(isEmptyAssistantResponse('hello'), false)
    })
  })

  describe('isProgressMessage', () => {
    test('以 <progress> 开头返回 true', () => {
      assert.equal(isProgressMessage('<progress> working...'), true)
    })

    test('不以 <progress> 开头返回 false', () => {
      assert.equal(isProgressMessage('done'), false)
    })
  })

  describe('isFinalMessage', () => {
    test('以 <final> 开头返回 true', () => {
      assert.equal(isFinalMessage('<final> task complete'), true)
    })

    test('不以 <final> 开头返回 false', () => {
      assert.equal(isFinalMessage('working'), false)
    })
  })

  describe('extractMessageKind', () => {
    test('提取 final', () => {
      assert.equal(extractMessageKind('<final> done'), 'final')
    })

    test('提取 progress', () => {
      assert.equal(extractMessageKind('<progress> working'), 'progress')
    })

    test('无标记返回 undefined', () => {
      assert.equal(extractMessageKind('hello'), undefined)
    })
  })

  describe('parseAssistantText', () => {
    test('解析 final 标记', () => {
      const result = parseAssistantText('<final> task complete')
      assert.equal(result.content, 'task complete')
      assert.equal(result.kind, 'final')
    })

    test('解析 progress 标记', () => {
      const result = parseAssistantText('<progress> working...')
      assert.equal(result.content, 'working...')
      assert.equal(result.kind, 'progress')
    })

    test('解析带闭合标签的内容', () => {
      const result = parseAssistantText('<progress> working...</progress>')
      assert.equal(result.content, 'working...')
      assert.equal(result.kind, 'progress')
    })

    test('无标记返回原内容', () => {
      const result = parseAssistantText('hello world')
      assert.equal(result.content, 'hello world')
      assert.equal(result.kind, undefined)
    })

    test('空内容返回空字符串', () => {
      const result = parseAssistantText('')
      assert.equal(result.content, '')
      assert.equal(result.kind, undefined)
    })
  })
})
