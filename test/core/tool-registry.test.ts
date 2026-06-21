import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../../src/core/tool-registry.js'
import { z } from 'zod'

describe('ToolRegistry', () => {
  test('getTool 返回已注册的工具', () => {
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {},
      schema: z.object({}),
      run: async () => ({ ok: true, output: 'ok' }),
    }
    const registry = new ToolRegistry([tool])
    assert.equal(registry.getTool('test_tool'), tool)
  })

  test('getTool 返回 undefined 对于未注册的工具', () => {
    const registry = new ToolRegistry([])
    assert.equal(registry.getTool('unknown'), undefined)
  })

  test('hasTool 正确判断工具是否存在', () => {
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {},
      schema: z.object({}),
      run: async () => ({ ok: true, output: 'ok' }),
    }
    const registry = new ToolRegistry([tool])
    assert.equal(registry.hasTool('test_tool'), true)
    assert.equal(registry.hasTool('unknown'), false)
  })

  test('getAllTools 返回所有工具', () => {
    const tool1 = {
      name: 'tool1',
      description: 'Tool 1',
      inputSchema: {},
      schema: z.object({}),
      run: async () => ({ ok: true, output: 'ok' }),
    }
    const tool2 = {
      name: 'tool2',
      description: 'Tool 2',
      inputSchema: {},
      schema: z.object({}),
      run: async () => ({ ok: true, output: 'ok' }),
    }
    const registry = new ToolRegistry([tool1, tool2])
    const tools = registry.getAllTools()
    assert.equal(tools.length, 2)
  })

  test('addTools 添加新工具', () => {
    const registry = new ToolRegistry([])
    const tool = {
      name: 'new_tool',
      description: 'A new tool',
      inputSchema: {},
      schema: z.object({}),
      run: async () => ({ ok: true, output: 'ok' }),
    }
    registry.addTools([tool])
    assert.equal(registry.hasTool('new_tool'), true)
  })

  test('addTools 跳过已存在的工具', () => {
    const tool1 = {
      name: 'test_tool',
      description: 'First',
      inputSchema: {},
      schema: z.object({}),
      execute: async () => ({ ok: true, output: 'first' }),
    }
    const tool2 = {
      name: 'test_tool',
      description: 'Second',
      inputSchema: {},
      schema: z.object({}),
      execute: async () => ({ ok: true, output: 'second' }),
    }
    const registry = new ToolRegistry([tool1])
    registry.addTools([tool2])
    assert.equal(registry.getTool('test_tool')?.description, 'First')
  })

  test('execute 正确执行工具', async () => {
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {},
      schema: z.object({ value: z.string() }),
      run: async (input: { value: string }) => ({
        ok: true,
        output: `Got: ${input.value}`,
      }),
    }
    const registry = new ToolRegistry([tool])
    const result = await registry.execute(
      'test_tool',
      { value: 'hello' },
      { cwd: '/test' },
    )
    assert.equal(result.ok, true)
    assert.equal(result.output, 'Got: hello')
  })

  test('execute 返回错误对于未知工具', async () => {
    const registry = new ToolRegistry([])
    const result = await registry.execute(
      'unknown',
      {},
      { cwd: '/test' },
    )
    assert.equal(result.ok, false)
    assert.ok(result.output.includes('Unknown tool'))
  })

  test('execute 返回错误对于无效输入', async () => {
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {},
      schema: z.object({ value: z.string() }),
      execute: async (input: { value: string }) => ({
        ok: true,
        output: `Got: ${input.value}`,
      }),
    }
    const registry = new ToolRegistry([tool])
    const result = await registry.execute(
      'test_tool',
      { value: 123 },
      { cwd: '/test' },
    )
    assert.equal(result.ok, false)
  })

  test('getSkills 返回技能列表', () => {
    const registry = new ToolRegistry([], {
      skills: [{ name: 'test-skill', description: 'A test skill', path: '/path', source: 'project' }],
    })
    assert.equal(registry.getSkills().length, 1)
    assert.equal(registry.getSkills()[0].name, 'test-skill')
  })

  test('getMcpServers 返回 MCP 服务器列表', () => {
    const registry = new ToolRegistry([], {
      mcpServers: [{ name: 'test-server', command: 'test', status: 'connected', toolCount: 0 }],
    })
    assert.equal(registry.getMcpServers().length, 1)
    assert.equal(registry.getMcpServers()[0].name, 'test-server')
  })

  test('setMcpServers 更新 MCP 服务器列表', () => {
    const registry = new ToolRegistry([])
    registry.setMcpServers([{ name: 'new-server', command: 'test', status: 'connected', toolCount: 0 }])
    assert.equal(registry.getMcpServers().length, 1)
    assert.equal(registry.getMcpServers()[0].name, 'new-server')
  })
})
