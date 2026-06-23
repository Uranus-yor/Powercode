import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canParallel } from '../../src/multi-agent/router.js'
import type { SubTask } from '../../src/multi-agent/types.js'

describe('canParallel', () => {
  it('returns true for empty task list', () => {
    assert.equal(canParallel([]), true)
  })

  it('returns true for single task', () => {
    const tasks: SubTask[] = [
      { id: 't1', description: 'Read file', tools: ['read_file'], depends_on: [] },
    ]
    assert.equal(canParallel(tasks), true)
  })

  describe('no conflict', () => {
    it('tasks write to different files', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Write a.ts',
          tools: ['write_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
        {
          id: 't2',
          description: 'Write b.ts',
          tools: ['write_file'],
          depends_on: [],
          target_files: ['src/b.ts'],
        },
      ]
      assert.equal(canParallel(tasks), true)
    })

    it('read and write to same file is not a conflict', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Read a.ts',
          tools: ['read_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
        {
          id: 't2',
          description: 'Write a.ts',
          tools: ['write_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
      ]
      assert.equal(canParallel(tasks), true)
    })
  })

  describe('has conflict', () => {
    it('tasks write to same file', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Write a.ts',
          tools: ['write_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
        {
          id: 't2',
          description: 'Edit a.ts',
          tools: ['edit_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
      ]
      assert.equal(canParallel(tasks), false)
    })

    it('tasks use modify_file on same file', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Modify a.ts',
          tools: ['modify_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
        {
          id: 't2',
          description: 'Write a.ts',
          tools: ['write_file'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
      ]
      assert.equal(canParallel(tasks), false)
    })
  })

  describe('edge cases', () => {
    it('empty target_files treated as no conflict', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Task 1',
          tools: ['write_file'],
          depends_on: [],
          target_files: [],
        },
        {
          id: 't2',
          description: 'Task 2',
          tools: ['write_file'],
          depends_on: [],
          target_files: [],
        },
      ]
      assert.equal(canParallel(tasks), true)
    })

    it('undefined target_files treated as no conflict', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Task 1',
          tools: ['write_file'],
          depends_on: [],
        },
        {
          id: 't2',
          description: 'Task 2',
          tools: ['write_file'],
          depends_on: [],
        },
      ]
      assert.equal(canParallel(tasks), true)
    })

    it('only checks write/edit/modify tools', () => {
      const tasks: SubTask[] = [
        {
          id: 't1',
          description: 'Grep a.ts',
          tools: ['grep_files'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
        {
          id: 't2',
          description: 'Run command',
          tools: ['run_command'],
          depends_on: [],
          target_files: ['src/a.ts'],
        },
      ]
      assert.equal(canParallel(tasks), true)
    })
  })
})
