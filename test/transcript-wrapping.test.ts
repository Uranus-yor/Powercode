import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractSelectedText,
  getTranscriptMaxScrollOffset,
  type TranscriptEntry,
  type TranscriptSelection,
} from '../src/tui/transcript.ts'

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

function makeWrappedAssistantEntry(): TranscriptEntry[] {
  const wrappedBody = `${'a'.repeat(166)}BCDEFG`
  return [
    {
      id: 1,
      kind: 'assistant',
      body: wrappedBody,
    },
  ]
}

describe('transcript wrapping', () => {
  it('counts wrapped visual rows when calculating scroll offset', () => {
    const entries = makeWrappedAssistantEntry()

    const offset = withTerminalWidth(60, () => getTranscriptMaxScrollOffset(entries, 4))

    assert.equal(offset, 0)
  })

  it('extracts text from a wrapped continuation row', () => {
    const entries = makeWrappedAssistantEntry()
    // With indentBlock('  ') prefix on assistant entries:
    // Line 0: '  ' + 58 a's = 60 chars
    // Line 1: 60 a's
    // Line 2: 48 a's + 'BCDEFG' = 54 chars
    // BCDEFG starts at col 48 on line 2
    const selection: TranscriptSelection = {
      startLine: 2,
      startCol: 48,
      endLine: 2,
      endCol: 54,
    }

    const selected = withTerminalWidth(60, () => extractSelectedText(entries, selection))

    assert.equal(selected, 'BCDEFG')
  })
})
