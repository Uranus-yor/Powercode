import type { TaskPlan, SubTask, Strategy, OutputMode } from './types.js'
import type { ModelAdapter, ChatMessage } from '../core/types.js'
import { z } from 'zod'

const ALLOWED_TOOLS = [
  'read_file', 'write_file', 'edit_file', 'modify_file', 'patch_file',
  'run_command', 'grep_files', 'list_files', 'web_search', 'web_fetch',
]

const SubTaskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  tools: z.array(z.enum(ALLOWED_TOOLS as [string, ...string[]])).default([]),
  depends_on: z.array(z.string()).default([]),
  target_files: z.array(z.string()).optional(),
  role: z.string().optional(),
})

const TaskPlanSchema = z.object({
  strategy: z.enum(['single', 'parallel', 'sequential']),
  outputMode: z.enum(['stream', 'collect']).default('stream'),
  reason: z.string().min(1),
  tasks: z.array(SubTaskSchema).default([]),
})

const CLASSIFY_PROMPT = `你是一个任务分类器和执行器。分析用户请求，判断任务复杂度并执行。

判断规则：
1. 如果任务简单、1-2步可完成（如：问一个问题、读一个文件、加个参数校验）→ 直接完成任务，返回结果
2. 如果任务有两步或两步以上，且子任务之间没有依赖关系 → 返回 parallel 任务拆分
3. 如果任务有先后依赖关系（如先重构再修改调用方）→ 返回 sequential 任务拆分

返回格式：

简单任务 → 直接返回结果（纯文本，不要 JSON）：
直接用文字回答用户的问题或完成任务。

复杂任务 → 返回 JSON 任务拆分：
{
  "strategy": "parallel" | "sequential",
  "outputMode": "stream" | "collect",
  "reason": "判断理由",
  "tasks": [
    {
      "id": "task-1",
      "description": "子任务描述",
      "tools": ["read_file", "write_file", "edit_file", "run_command", "grep_files", "list_files"],
      "depends_on": []
    }
  ]
}

注意：
- 简单任务直接返回结果，不要返回 JSON
- 复杂任务返回 JSON，不要有其他内容
- parallel 模式下 tasks 应该是多个独立子任务，outputMode 为 "stream"
- sequential 模式下 tasks 应该有依赖关系（depends_on 指向依赖的任务 id），outputMode 为 "collect"
- tools 只能使用以下工具：read_file, write_file, edit_file, modify_file, patch_file, run_command, grep_files, list_files, web_search, web_fetch`

function parseLLMResponse(content: string): { type: 'answer'; answer: string } | { type: 'plan'; plan: TaskPlan } | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { type: 'answer', answer: content }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const result = TaskPlanSchema.safeParse(parsed)

    if (!result.success) {
      return { type: 'answer', answer: content }
    }

    const { strategy, outputMode, reason, tasks } = result.data

    if (strategy === 'single') {
      return { type: 'answer', answer: reason }
    }

    const subTasks: SubTask[] = tasks.map(t => ({
      id: t.id,
      description: t.description,
      tools: t.tools,
      depends_on: t.depends_on,
      target_files: t.target_files,
    }))

    return {
      type: 'plan',
      plan: {
        strategy: strategy as Strategy,
        outputMode: outputMode as OutputMode,
        reason,
        tasks: subTasks,
      },
    }
  } catch {
    return { type: 'answer', answer: content }
  }
}

export async function classifyTask(
  input: string,
  contextUtilization: number = 0,
  model?: ModelAdapter,
): Promise<TaskPlan> {
  if (!input || input.trim().length === 0) {
    return {
      strategy: 'single',
      outputMode: 'stream',
      reason: 'Empty input',
      tasks: [],
    }
  }

  if (contextUtilization > 0.8) {
    return {
      strategy: 'single',
      outputMode: 'stream',
      reason: 'Context utilization too high for multi-agent overhead',
      tasks: [],
    }
  }

  if (!model) {
    return {
      strategy: 'single',
      outputMode: 'stream',
      reason: 'No model available for classification',
      tasks: [],
    }
  }

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: CLASSIFY_PROMPT },
      { role: 'user', content: input },
    ]

    console.log('[Router] Calling LLM to classify task...')
    const response = await model.next(messages)
    const content = response.type === 'assistant' ? response.content : ''

    console.log('[Router] LLM response:', content.slice(0, 500))

    if (content) {
      const result = parseLLMResponse(content)
      console.log('[Router] Parsed result:', JSON.stringify(result, null, 2))

      if (result) {
        if (result.type === 'answer') {
          console.log('[Router] LLM returned answer (simple task)')
          return {
            strategy: 'single',
            outputMode: 'stream',
            reason: 'Simple task, LLM answered directly',
            tasks: [],
            answer: result.answer,
          }
        }
        console.log('[Router] LLM returned plan:', result.plan.strategy)
        return result.plan
      }
    }
  } catch (error) {
    console.error('[Router] LLM call failed:', error)
  }

  return {
    strategy: 'single',
    outputMode: 'stream',
    reason: 'Failed to classify, defaulting to single agent',
    tasks: [],
  }
}

// ========== 任务拆分（工具模式） ==========

const DECOMPOSE_PROMPT = `你是一个任务编排器。用户会给你一个任务，你需要拆分成多个独立的子任务。

重要规则：
- 只拆分独立的、可以并行执行的任务
- 不要创建"汇总"或"总结"类型的子任务，编排器会自动汇总结果
- 每个子任务应该是一个独立的行动（如搜索、读取、分析、审查）

可用工具：read_file, write_file, edit_file, modify_file, patch_file, run_command, grep_files, list_files, web_search, web_fetch

可选角色（根据任务自由设定）：
- 数据研究员：负责搜索、收集数据
- 代码审查员：负责审查代码质量、安全漏洞
- 测试工程师：负责编写和运行测试
- 重构专家：负责代码重构
- 调试专家：负责定位和修复 bug

返回 JSON：
{
  "strategy": "parallel" | "sequential",
  "reason": "拆分理由",
  "tasks": [
    {
      "id": "task-1",
      "role": "数据研究员",
      "description": "作为数据研究员，搜索...",
      "tools": ["web_search", "web_fetch"],
      "depends_on": []
    }
  ]
}

strategy 选择规则：
- 如果子任务之间没有依赖关系 → "parallel"（并行执行，更快）
- 如果子任务有先后依赖（如先重构再修改调用方）→ "sequential"
- 大多数情况下应该用 "parallel"

注意：
- 每个子任务的 description 要足够详细，让子 agent 能独立执行
- tools 只填该子任务需要的工具
- 返回纯 JSON，不要有其他内容`

const DecomposePlanSchema = z.object({
  strategy: z.enum(['parallel', 'sequential']),
  reason: z.string().min(1),
  tasks: z.array(SubTaskSchema).min(1),
})

export async function decomposeTask(
  task: string,
  model: ModelAdapter,
): Promise<{ plan: TaskPlan | null; error: string | null }> {
  if (!task || task.trim().length === 0) {
    return { plan: null, error: 'Empty task' }
  }

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: DECOMPOSE_PROMPT },
      { role: 'user', content: task },
    ]

    const response = await model.next(messages)
    const content = response.type === 'assistant' ? response.content : ''

    if (!content) {
      return { plan: null, error: 'LLM returned empty response' }
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { plan: null, error: 'LLM did not return JSON. Response: ' + content.slice(0, 200) }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const result = DecomposePlanSchema.safeParse(parsed)

    if (!result.success) {
      return { plan: null, error: 'Invalid task plan: ' + result.error.message }
    }

    const subTasks: SubTask[] = result.data.tasks.map(t => ({
      id: t.id,
      description: t.description,
      tools: t.tools,
      depends_on: t.depends_on,
      target_files: t.target_files,
      role: t.role,
    }))

    return {
      plan: {
        strategy: result.data.strategy,
        outputMode: result.data.strategy === 'sequential' ? 'collect' : 'stream',
        reason: result.data.reason,
        tasks: subTasks,
      },
      error: null,
    }
  } catch (error) {
    return {
      plan: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function canParallel(tasks: SubTask[]): boolean {
  if (tasks.length <= 1) return true

  const writeTargets: string[][] = tasks.map(task =>
    task.tools.includes('write_file') || task.tools.includes('edit_file') || task.tools.includes('modify_file')
      ? (task.target_files ?? [])
      : [],
  )

  for (let i = 0; i < writeTargets.length; i++) {
    for (let j = i + 1; j < writeTargets.length; j++) {
      if (hasOverlap(writeTargets[i]!, writeTargets[j]!)) {
        return false
      }
    }
  }

  return true
}

function hasOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  const setB = new Set(b)
  return a.some(file => setB.has(file))
}
