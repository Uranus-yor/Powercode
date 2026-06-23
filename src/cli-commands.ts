import {
  CLAUDE_SETTINGS_PATH,
  POWER_CODE_MCP_PATH,
  POWER_CODE_PERMISSIONS_PATH,
  POWER_CODE_SETTINGS_PATH,
  loadRuntimeConfig,
  savePowerCodeSettings,
} from './config.js'
import { initializeRepo, renderInitReport } from './init.js'
import { discoverInstructionFiles, renderMemoryReport } from './memory.js'
import type { ToolRegistry } from './core/tool-registry.js'

/** 斜杠命令类型 */
export type SlashCommand = {
  name: string
  usage: string
  description: string
  category: string
}

/**
 * CLI 命令处理模块
 * 处理斜杠命令、命令补全和本地命令
 */

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── Session ──
  {
    name: '/new',
    usage: '/new',
    description: 'Clear saved session and start fresh.',
    category: 'Session',
  },
  {
    name: '/resume',
    usage: '/resume',
    description: 'Resume a saved session (interactive picker, or /resume <id>).',
    category: 'Session',
  },
  {
    name: '/rename',
    usage: '/rename <name>',
    description: 'Rename the current session.',
    category: 'Session',
  },
  {
    name: '/fork',
    usage: '/fork',
    description: 'Fork current session into a new independent session.',
    category: 'Session',
  },
  {
    name: '/exit',
    usage: '/exit',
    description: 'Exit PowerCode.',
    category: 'Session',
  },
  // ── Info ──
  {
    name: '/help',
    usage: '/help',
    description: 'Show available slash commands.',
    category: 'Info',
  },
  {
    name: '/status',
    usage: '/status',
    description: 'Show current model and config source.',
    category: 'Info',
  },
  {
    name: '/model',
    usage: '/model',
    description: 'Show the current model.',
    category: 'Info',
  },
  {
    name: '/model',
    usage: '/model <model-name>',
    description: 'Persist a model override into ~/.powercode/settings.json.',
    category: 'Info',
  },
  {
    name: '/tools',
    usage: '/tools',
    description: 'List tools available to the coding agent and tool shortcuts.',
    category: 'Info',
  },
  {
    name: '/skills',
    usage: '/skills',
    description: 'List discovered SKILL.md workflows.',
    category: 'Info',
  },
  {
    name: '/mcp',
    usage: '/mcp',
    description: 'Show configured MCP servers and connection state.',
    category: 'Info',
  },
  {
    name: '/memory',
    usage: '/memory',
    description: 'Show instruction files loaded into the system prompt.',
    category: 'Info',
  },
  {
    name: '/config-paths',
    usage: '/config-paths',
    description: 'Show PowerCode and Claude fallback settings paths.',
    category: 'Info',
  },
  {
    name: '/permissions',
    usage: '/permissions',
    description: 'Show PowerCode permission storage path.',
    category: 'Info',
  },
  // ── File Ops ──
  {
    name: '/ls',
    usage: '/ls [path]',
    description: 'List files in a directory.',
    category: 'File Ops',
  },
  {
    name: '/grep',
    usage: '/grep <pattern>::[path]',
    description: 'Search text in files.',
    category: 'File Ops',
  },
  {
    name: '/read',
    usage: '/read <path>',
    description: 'Read a file directly.',
    category: 'File Ops',
  },
  {
    name: '/write',
    usage: '/write <path>::<content>',
    description: 'Write a file directly.',
    category: 'File Ops',
  },
  {
    name: '/modify',
    usage: '/modify <path>::<content>',
    description: 'Replace a file, showing a reviewable diff before applying it.',
    category: 'File Ops',
  },
  {
    name: '/edit',
    usage: '/edit <path>::<search>::<replace>',
    description: 'Edit a file by exact replacement.',
    category: 'File Ops',
  },
  {
    name: '/patch',
    usage: '/patch <path>::<search1>::<replace1>::<search2>::<replace2>...',
    description: 'Apply multiple replacements to one file in one command.',
    category: 'File Ops',
  },
  // ── Context ──
  {
    name: '/compact',
    usage: '/compact',
    description: 'Compress conversation context to free up context window space.',
    category: 'Context',
  },
  {
    name: '/collapse',
    usage: '/collapse',
    description: 'Project old safe context spans into summaries without deleting the transcript.',
    category: 'Context',
  },
  {
    name: '/snip',
    usage: '/snip',
    description: 'Remove a safe middle segment of conversation context without calling the model.',
    category: 'Context',
  },
  // ── Dev ──
  {
    name: '/cmd',
    usage: '/cmd [cwd::]<command> [args...]',
    description: 'Run an allowed development command directly, optionally in another directory.',
    category: 'Dev',
  },
  {
    name: '/init',
    usage: '/init',
    description: 'Create .powercode/, .gitignore entries, and MINI.md in the current project (idempotent).',
    category: 'Dev',
  },
  {
    name: '/multi',
    usage: '/multi',
    description: 'Test multi-agent system with a demo task.',
    category: 'Dev',
  },
]

export function formatSlashCommands(): string {
  return SLASH_COMMANDS.map(command => `${command.usage}  ${command.description}`).join('\n')
}

export function findMatchingSlashCommands(input: string): string[] {
  return SLASH_COMMANDS
    .map(command => command.usage)
    .filter(command => command.startsWith(input))
}

/** 中文别名映射表 */
export const COMMAND_ALIASES: Record<string, string> = {
  '/搜索': '/grep',
  '/读取': '/read',
  '/写入': '/write',
  '/技能': '/skills',
  '/工具': '/tools',
  '/帮助': '/help',
  '/状态': '/status',
  '/模型': '/model',
  '/压缩': '/compact',
  '/退出': '/exit',
}

/**
 * 解析中文别名，返回对应的英文命令
 * 如果不是别名，原样返回
 */
export function resolveAlias(input: string): string {
  const trimmed = input.trim()
  // 精确匹配：/帮助 → /help
  if (COMMAND_ALIASES[trimmed]) {
    return COMMAND_ALIASES[trimmed]
  }
  // 带参数匹配：/搜索 test → /grep test
  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex !== -1) {
    const prefix = trimmed.slice(0, spaceIndex)
    const rest = trimmed.slice(spaceIndex)
    if (COMMAND_ALIASES[prefix]) {
      return COMMAND_ALIASES[prefix] + rest
    }
  }
  return input
}

/**
 * 查找匹配别名前缀的命令（用于 Tab 补全）
 */
export function findMatchingAliases(input: string): string[] {
  return Object.keys(COMMAND_ALIASES).filter(alias => alias.startsWith(input))
}

export async function tryHandleLocalCommand(
  input: string,
  context?: {
    cwd?: string
    tools?: ToolRegistry
  },
): Promise<string | null> {
  const cwd = context?.cwd ?? process.cwd()

  if (input === '/') {
    return formatSlashCommands()
  }

  if (input === '/help') {
    return formatSlashCommands()
  }

  if (input === '/config-paths') {
    return [
      `PowerCode settings: ${POWER_CODE_SETTINGS_PATH}`,
      `PowerCode permissions: ${POWER_CODE_PERMISSIONS_PATH}`,
      `PowerCode mcp: ${POWER_CODE_MCP_PATH}`,
      `compat fallback: ${CLAUDE_SETTINGS_PATH}`,
    ].join('\n')
  }

  if (input === '/permissions') {
    return `permission store: ${POWER_CODE_PERMISSIONS_PATH}`
  }

  if (input === '/skills') {
    const skills = context?.tools?.getSkills() ?? []
    if (skills.length === 0) {
      return 'No skills discovered. Add skills under ~/.powercode/skills/<name>/SKILL.md, .powercode/skills/<name>/SKILL.md, .claude/skills/<name>/SKILL.md, or ~/.claude/skills/<name>/SKILL.md.'
    }

    return skills
      .map(
        skill =>
          `${skill.name}  ${skill.description}  [${skill.source}]`,
      )
      .join('\n')
  }

  if (input === '/mcp') {
    const servers = context?.tools?.getMcpServers() ?? []
    if (servers.length === 0) {
      return 'No MCP servers configured. Add mcpServers to ~/.powercode/settings.json, ~/.powercode/mcp.json, or project .mcp.json.'
    }

    return servers
      .map(server => {
        const suffix = server.error ? `  error=${server.error}` : ''
        const protocol = server.protocol ? `  protocol=${server.protocol}` : ''
        const resources =
          server.resourceCount !== undefined
            ? `  resources=${server.resourceCount}`
            : ''
        const prompts =
          server.promptCount !== undefined
            ? `  prompts=${server.promptCount}`
            : ''
        return `${server.name}  status=${server.status}  tools=${server.toolCount}${resources}${prompts}${protocol}${suffix}`
      })
      .join('\n')
  }

  if (input === '/status') {
    const runtime = await loadRuntimeConfig()
    return [
      `model: ${runtime.model}`,
      `baseUrl: ${runtime.baseUrl}`,
      `auth: ${runtime.authToken ? 'ANTHROPIC_AUTH_TOKEN' : 'ANTHROPIC_API_KEY'}`,
      `mcp servers: ${Object.keys(runtime.mcpServers).length}`,
      runtime.sourceSummary,
    ].join('\n')
  }

  if (input === '/init') {
    const report = await initializeRepo(cwd)
    return renderInitReport(report)
  }

  if (input === '/memory') {
    const files = await discoverInstructionFiles(cwd)
    return renderMemoryReport(files, cwd)
  }

  if (input === '/multi') {
    return 'Multi-agent test mode. Send a complex task like "审查 src/config.ts，顺便跑一下测试" to trigger multi-agent mode.'
  }

  if (input === '/model') {
    const runtime = await loadRuntimeConfig()
    return `current model: ${runtime.model}`
  }

  if (input.startsWith('/model ')) {
    const model = input.slice('/model '.length).trim()
    if (!model) {
      return '用法: /model <model-name>'
    }

    await savePowerCodeSettings({ model })
    return `saved model=${model} to ${POWER_CODE_SETTINGS_PATH}`
  }

  return null
}

export function completeSlashCommand(line: string): [string[], string] {
  const hits = SLASH_COMMANDS
    .map(command => command.usage)
    .filter(command => command.startsWith(line))

  return [hits.length > 0 ? hits : SLASH_COMMANDS.map(command => command.usage), line]
}
