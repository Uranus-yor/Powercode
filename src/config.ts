import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isEnoentError } from './utils/errors.js'

/** PowerCode 设置类型 */
export type PowerCodeSettings = {
  env?: Record<string, string | number>
  model?: string
  maxOutputTokens?: number
  mcpServers?: Record<string, McpServerConfig>
}

/** MCP 服务器配置类型 */
export type McpServerConfig = {
  command: string
  args?: string[]
  env?: Record<string, string | number>
  url?: string
  headers?: Record<string, string | number>
  cwd?: string
  enabled?: boolean
  protocol?: 'auto' | 'content-length' | 'newline-json' | 'streamable-http'
}

/** 运行时配置类型 */
export type RuntimeConfig = {
  model: string
  baseUrl: string
  authToken?: string
  apiKey?: string
  maxOutputTokens?: number
  mcpServers: Record<string, McpServerConfig>
  sourceSummary: string
}

/** MCP 配置作用域类型 */
export type McpConfigScope = 'user' | 'project'

export const POWER_CODE_DIR = process.env.POWERCODE_HOME
  ? path.resolve(process.env.POWERCODE_HOME)
  : path.join(os.homedir(), '.powercode')
export const POWER_CODE_SETTINGS_PATH = path.join(POWER_CODE_DIR, 'settings.json')
export const POWER_CODE_HISTORY_PATH = path.join(POWER_CODE_DIR, 'history.jsonl')
export const POWER_CODE_PERMISSIONS_PATH = path.join(POWER_CODE_DIR, 'permissions.json')
export const POWER_CODE_MCP_PATH = path.join(POWER_CODE_DIR, 'mcp.json')
export const POWER_CODE_MCP_TOKENS_PATH = path.join(POWER_CODE_DIR, 'mcp-tokens.json')
export const POWER_CODE_PROJECTS_DIR = path.join(POWER_CODE_DIR, 'projects')
export const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')
export const PROJECT_MCP_PATH = path.join(process.cwd(), '.mcp.json')

/**
 * 读取 MCP 令牌文件
 * 返回服务器名称到令牌的映射
 */
export async function readMcpTokensFile(
  filePath = POWER_CODE_MCP_TOKENS_PATH,
): Promise<Record<string, string>> {
  try {
    const content = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(content) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    return parsed as Record<string, string>
  } catch (error) {
    if (isEnoentError(error)) return {}
    throw error
  }
}

/**
 * 保存 MCP 令牌文件
 * 将服务器名称到令牌的映射写入文件
 */
export async function saveMcpTokensFile(
  tokens: Record<string, string>,
  filePath = POWER_CODE_MCP_TOKENS_PATH,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(tokens, null, 2)}\n`, 'utf8')
}

async function readSettingsFile(filePath: string): Promise<PowerCodeSettings> {
  try {
    const content = await readFile(filePath, 'utf8')
    return JSON.parse(content) as PowerCodeSettings
  } catch (error) {
    if (isEnoentError(error)) {
      return {}
    }

    throw error
  }
}

/**
 * 读取 MCP 配置文件
 * 返回服务器名称到配置的映射
 */
export async function readMcpConfigFile(
  filePath: string,
): Promise<Record<string, McpServerConfig>> {
  try {
    const content = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(content) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('mcpServers' in parsed) ||
      typeof parsed.mcpServers !== 'object' ||
      parsed.mcpServers === null
    ) {
      return {}
    }

    return parsed.mcpServers as Record<string, McpServerConfig>
  } catch (error) {
    if (isEnoentError(error)) {
      return {}
    }

    throw error
  }
}

/**
 * 获取 MCP 配置文件路径
 * 根据作用域返回用户级或项目级配置路径
 */
export function getMcpConfigPath(
  scope: McpConfigScope,
  cwd = process.cwd(),
): string {
  return scope === 'project' ? path.join(cwd, '.mcp.json') : POWER_CODE_MCP_PATH
}

/**
 * 加载指定作用域的 MCP 服务器配置
 */
export async function loadScopedMcpServers(
  scope: McpConfigScope,
  cwd = process.cwd(),
): Promise<Record<string, McpServerConfig>> {
  return readMcpConfigFile(getMcpConfigPath(scope, cwd))
}

/**
 * 保存指定作用域的 MCP 服务器配置
 */
export async function saveScopedMcpServers(
  scope: McpConfigScope,
  servers: Record<string, McpServerConfig>,
  cwd = process.cwd(),
): Promise<void> {
  const targetPath = getMcpConfigPath(scope, cwd)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(
    targetPath,
    `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`,
    'utf8',
  )
}

function mergeSettings(
  base: PowerCodeSettings,
  override: PowerCodeSettings,
): PowerCodeSettings {
  const mergedMcpServers = {
    ...(base.mcpServers ?? {}),
  }

  for (const [name, server] of Object.entries(override.mcpServers ?? {})) {
    mergedMcpServers[name] = {
      ...(mergedMcpServers[name] ?? {}),
      ...server,
      env: {
        ...(mergedMcpServers[name]?.env ?? {}),
        ...(server.env ?? {}),
      },
      headers: {
        ...(mergedMcpServers[name]?.headers ?? {}),
        ...(server.headers ?? {}),
      },
    }
  }

  return {
    ...base,
    ...override,
    env: {
      ...(base.env ?? {}),
      ...(override.env ?? {}),
    },
    mcpServers: mergedMcpServers,
  }
}

/**
 * 加载有效设置
 * 合并 Claude 设置、全局 MCP 配置、项目 MCP 配置和 PowerCode 设置
 */
export async function loadEffectiveSettings(): Promise<PowerCodeSettings> {
  const [claudeSettings, globalMcpConfig, projectMcpConfig, powerCodeSettings] =
    await Promise.all([
      readSettingsFile(CLAUDE_SETTINGS_PATH),
      readMcpConfigFile(POWER_CODE_MCP_PATH),
      readMcpConfigFile(PROJECT_MCP_PATH),
      readSettingsFile(POWER_CODE_SETTINGS_PATH),
    ])
  return mergeSettings(
    mergeSettings(
      mergeSettings(claudeSettings, { mcpServers: globalMcpConfig }),
      { mcpServers: projectMcpConfig },
    ),
    powerCodeSettings,
  )
}

/**
 * 保存 PowerCode 设置
 * 合并现有设置并写入文件
 */
export async function savePowerCodeSettings(
  updates: PowerCodeSettings,
): Promise<void> {
  await mkdir(POWER_CODE_DIR, { recursive: true })
  const existing = await readSettingsFile(POWER_CODE_SETTINGS_PATH)
  const next = mergeSettings(existing, updates)
  await writeFile(
    POWER_CODE_SETTINGS_PATH,
    `${JSON.stringify(next, null, 2)}\n`,
    'utf8',
  )
}

/**
 * 加载运行时配置
 * 从环境变量和设置文件中构建完整的运行时配置
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const effectiveSettings = await loadEffectiveSettings()
  const env = {
    ...(effectiveSettings.env ?? {}),
    ...process.env,
  }

  const model =
    process.env.POWER_CODE_MODEL ||
    effectiveSettings.model ||
    String(env.ANTHROPIC_MODEL ?? '').trim()

  const baseUrl =
    String(env.ANTHROPIC_BASE_URL ?? '').trim() || 'https://api.anthropic.com'
  const authToken = String(env.ANTHROPIC_AUTH_TOKEN ?? '').trim() || undefined
  const apiKey = String(env.ANTHROPIC_API_KEY ?? '').trim() || undefined
  const rawMaxOutputTokens =
    process.env.POWER_CODE_MAX_OUTPUT_TOKENS ??
    effectiveSettings.maxOutputTokens ??
    env.POWER_CODE_MAX_OUTPUT_TOKENS
  const parsedMaxOutputTokens =
    rawMaxOutputTokens === undefined ? NaN : Number(rawMaxOutputTokens)
  const maxOutputTokens =
    Number.isFinite(parsedMaxOutputTokens) && parsedMaxOutputTokens > 0
      ? Math.floor(parsedMaxOutputTokens)
      : undefined

  if (!model) {
    throw new Error(
      `No model configured. Set ~/.powercode/settings.json or env.ANTHROPIC_MODEL.`,
    )
  }

  if (!authToken && !apiKey) {
    throw new Error(
      `No auth configured. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY in ~/.powercode/settings.json or process env.`,
    )
  }

  return {
    model,
    baseUrl,
    authToken,
    apiKey,
    maxOutputTokens,
    mcpServers: effectiveSettings.mcpServers ?? {},
    sourceSummary: `config: ${POWER_CODE_SETTINGS_PATH} > ${CLAUDE_SETTINGS_PATH} > process.env`,
  }
}
