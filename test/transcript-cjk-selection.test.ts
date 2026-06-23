import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractSelectedText,
  renderTranscript,
  type TranscriptEntry,
  type TranscriptSelection,
} from '../src/tui/transcript.ts'

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[\d;]*[A-Za-z]/g, '')
}

function withTerminalWidth<T>(columns: number, fn: () => T): T {
  const original = process.stdout.columns
  Object.defineProperty(process.stdout, 'columns', {
    value: columns,
    configurable: true,
  })
  try {
    return fn()
  } finally {
    Object.defineProperty(process.stdout, 'columns', {
      value: original,
      configurable: true,
    })
  }
}

describe('transcript CJK selection', () => {
  it('highlights a single full-width CJK character by display column', () => {
    const entries: TranscriptEntry[] = [
      { id: 1, kind: 'assistant', body: '你A' },
    ]
    // '你' is at columns 0-2, 'A' is at column 2
    const selection: TranscriptSelection = {
      startLine: 0,
      startCol: 0,
      endLine: 0,
      endCol: 2,
    }

    const rendered = withTerminalWidth(60, () => renderTranscript(entries, 0, 10, selection))
    const plain = stripAnsi(rendered)

    assert.ok(plain.includes('你A'))
    assert.ok(rendered.includes('\u001b[7m你\u001b[0m'))
  })

  it('extracts a single full-width CJK character by display column', () => {
    const entries: TranscriptEntry[] = [
      { id: 1, kind: 'assistant', body: '你A' },
    ]
    const selection: TranscriptSelection = {
      startLine: 0,
      startCol: 0,
      endLine: 0,
      endCol: 2,
    }

    const selected = withTerminalWidth(60, () => extractSelectedText(entries, selection))

    assert.equal(selected, '你')
  })
})
