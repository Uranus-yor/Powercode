/**
 * 智能代码搜索基准测试
 * 对比 grep 和智能搜索的效果
 */

import { buildIndex } from '../src/code-index/indexer.js'
import { createSearchEngine } from '../src/code-index/search.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'

const execFileAsync = promisify(execFile)

type BenchmarkTask = {
  id: string
  question: string
  searchQueries: string[]
  expectedFiles: string[]
  expectedKeywords: string[]
  difficulty: 'easy' | 'medium' | 'hard'
}

const BENCHMARK_TASKS: BenchmarkTask[] = [
  {
    id: 'find-references',
    question: 'createUser 函数在哪些文件中被调用了？',
    searchQueries: ['createUser'],
    expectedFiles: ['src/routes/user-routes.ts', 'test/user-service.test.ts'],
    expectedKeywords: ['user-routes', 'test'],
    difficulty: 'easy',
  },
  {
    id: 'impact-analysis',
    question: '如果我修改 User 类的结构，哪些文件需要跟着改？',
    searchQueries: ['User', 'import.*User', 'new User'],
    expectedFiles: [
      'src/services/user-service.ts',
      'src/services/order-service.ts',
      'src/routes/user-routes.ts',
      'test/user-service.test.ts',
    ],
    expectedKeywords: ['service', 'routes', 'test'],
    difficulty: 'medium',
  },
  {
    id: 'call-chain',
    question: '从 user-routes.ts 追踪完整调用链',
    searchQueries: ['handleCreateUser', 'createUser', 'UserService', 'query'],
    expectedFiles: [
      'src/routes/user-routes.ts',
      'src/services/user-service.ts',
      'src/models/user.ts',
      'src/utils/db.ts',
    ],
    expectedKeywords: ['routes', 'service', 'model', 'db'],
    difficulty: 'hard',
  },
  {
    id: 'find-all-services',
    question: '这个项目有哪些 Service 类？',
    searchQueries: ['Service', 'class.*Service'],
    expectedFiles: [
      'src/services/user-service.ts',
      'src/services/order-service.ts',
    ],
    expectedKeywords: ['UserService', 'OrderService'],
    difficulty: 'easy',
  },
  {
    id: 'dependency-direction',
    question: 'order-service.ts 依赖了哪些文件？',
    searchQueries: ['import.*from.*order-service', 'OrderService'],
    expectedFiles: [
      'src/models/order.ts',
      'src/services/user-service.ts',
      'src/routes/order-routes.ts',
    ],
    expectedKeywords: ['import', 'OrderService'],
    difficulty: 'medium',
  },
]

const PROJECT_PATH = path.resolve('./test/fixtures/sample-project')

/** 使用 grep 搜索 */
async function runGrepSearch(query: string): Promise<string[]> {
  try {
    const result = await execFileAsync('grep', ['-r', '-l', query, PROJECT_PATH], {
      maxBuffer: 1024 * 1024,
    })
    const files = (result.stdout || '').trim().split('\n').filter(Boolean)
    return files.map(f => f.replace(PROJECT_PATH + '/', '').replace(PROJECT_PATH + '\\', ''))
  } catch {
    return []
  }
}

/** 使用智能搜索 */
async function runSmartSearch(engine: any, query: string): Promise<string[]> {
  const results = await engine.search(query, { limit: 10 })
  return results.map((r: any) => r.file)
}

/** 计算精准率和召回率 */
function calculateMetrics(found: string[], expected: string[]) {
  const foundNames = found.map(f => path.basename(f))
  const expectedNames = expected.map(f => path.basename(f))

  const truePositives = expectedNames.filter(e =>
    foundNames.some(f => f.includes(e) || e.includes(f))
  )

  const precision = foundNames.length > 0 ? truePositives.length / foundNames.length : 0
  const recall = expectedNames.length > 0 ? truePositives.length / expectedNames.length : 0

  return { precision, recall, truePositives: truePositives.length }
}

async function runBenchmark() {
  console.log('=== 智能代码搜索基准测试 ===\n')
  console.log(`项目路径: ${PROJECT_PATH}\n`)

  // 构建索引
  console.log('构建索引中...')
  const startTime = Date.now()
  const index = await buildIndex(PROJECT_PATH)
  const indexTime = Date.now() - startTime
  console.log(`索引构建完成: ${indexTime}ms`)
  console.log(`文件数: ${index.metadata.fileCount}`)
  console.log(`符号数: ${index.metadata.symbolCount}`)
  console.log('---\n')

  const engine = createSearchEngine(index)

  // 统计
  let grepTotalPrecision = 0, grepTotalRecall = 0
  let smartTotalPrecision = 0, smartTotalRecall = 0

  for (const task of BENCHMARK_TASKS) {
    console.log(`任务: ${task.question}`)
    console.log(`难度: ${task.difficulty}`)

    // Grep 搜索
    const grepResults = new Set<string>()
    for (const query of task.searchQueries) {
      const files = await runGrepSearch(query)
      files.forEach(f => grepResults.add(f))
    }
    const grepFiles = Array.from(grepResults)
    const grepMetrics = calculateMetrics(grepFiles, task.expectedFiles)

    // 智能搜索
    const smartResults = new Set<string>()
    for (const query of task.searchQueries) {
      const files = await runSmartSearch(engine, query)
      files.forEach(f => smartResults.add(f))
    }
    const smartFiles = Array.from(smartResults)
    const smartMetrics = calculateMetrics(smartFiles, task.expectedFiles)

    console.log(`\nGrep 结果:`)
    console.log(`  找到文件: ${grepFiles.join(', ') || '无'}`)
    console.log(`  精准率: ${(grepMetrics.precision * 100).toFixed(1)}%`)
    console.log(`  召回率: ${(grepMetrics.recall * 100).toFixed(1)}%`)

    console.log(`\n智能搜索结果:`)
    console.log(`  找到文件: ${smartFiles.join(', ') || '无'}`)
    console.log(`  精准率: ${(smartMetrics.precision * 100).toFixed(1)}%`)
    console.log(`  召回率: ${(smartMetrics.recall * 100).toFixed(1)}%`)

    console.log('---')

    grepTotalPrecision += grepMetrics.precision
    grepTotalRecall += grepMetrics.recall
    smartTotalPrecision += smartMetrics.precision
    smartTotalRecall += smartMetrics.recall
  }

  const taskCount = BENCHMARK_TASKS.length

  console.log('\n=== 汇总对比 ===\n')
  console.log('指标\t\t\tGrep\t智能搜索')
  console.log('----------------------------------------')
  console.log(`平均精准率\t\t${((grepTotalPrecision / taskCount) * 100).toFixed(1)}%\t${((smartTotalPrecision / taskCount) * 100).toFixed(1)}%`)
  console.log(`平均召回率\t\t${((grepTotalRecall / taskCount) * 100).toFixed(1)}%\t${((smartTotalRecall / taskCount) * 100).toFixed(1)}%`)
  console.log(`索引构建时间\t\t-\t${indexTime}ms`)
}

runBenchmark().catch(console.error)
