import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

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

const PROJECT_PATH = './test/fixtures/sample-project'

async function runGrepSearch(query: string): Promise<string[]> {
  try {
    const result = await execFileAsync('grep', ['-r', '-l', query, PROJECT_PATH], {
      maxBuffer: 1024 * 1024,
    })
    const files = (result.stdout || '').trim().split('\n').filter(Boolean)
    return files.map(f => f.replace(PROJECT_PATH + '/', ''))
  } catch {
    return []
  }
}

async function runBenchmark() {
  console.log('=== grep_files 基准测试 ===\n')

  let totalTasks = 0
  let totalFilePrecision = 0
  let totalFileRecall = 0
  let totalKeywordPrecision = 0
  let totalKeywordRecall = 0

  for (const task of BENCHMARK_TASKS) {
    console.log(`任务: ${task.question}`)
    console.log(`难度: ${task.difficulty}`)

    // 执行所有搜索查询
    const allFoundFiles = new Set<string>()
    for (const query of task.searchQueries) {
      const files = await runGrepSearch(query)
      files.forEach(f => allFoundFiles.add(f))
    }

    const foundFiles = Array.from(allFoundFiles)

    // 计算文件精准率和召回率
    const expectedFileNames = task.expectedFiles.map(f => f.split('/').pop()!)
    const foundFileNames = foundFiles.map(f => f.split('/').pop()!)

    const fileTruePositives = expectedFileNames.filter(f =>
      foundFileNames.some(found => found.includes(f) || f.includes(found))
    )

    const filePrecision =
      foundFileNames.length > 0 ? fileTruePositives.length / foundFileNames.length : 0
    const fileRecall =
      expectedFileNames.length > 0 ? fileTruePositives.length / expectedFileNames.length : 0

    // 计算关键词精准率和召回率
    const foundContent = foundFiles.join(' ')
    const keywordTruePositives = task.expectedKeywords.filter(k =>
      foundContent.includes(k)
    )

    const keywordPrecision =
      task.expectedKeywords.length > 0
        ? keywordTruePositives.length / task.expectedKeywords.length
        : 0
    const keywordRecall = keywordPrecision // 简化：假设关键词召回率等于精准率

    console.log(`找到的文件: ${foundFiles.length} 个`)
    console.log(`文件: ${foundFiles.join(', ')}`)
    console.log(`文件精准率: ${(filePrecision * 100).toFixed(1)}%`)
    console.log(`文件召回率: ${(fileRecall * 100).toFixed(1)}%`)
    console.log(`关键词精准率: ${(keywordPrecision * 100).toFixed(1)}%`)
    console.log(`关键词召回率: ${(keywordRecall * 100).toFixed(1)}%`)
    console.log('---')

    totalTasks++
    totalFilePrecision += filePrecision
    totalFileRecall += fileRecall
    totalKeywordPrecision += keywordPrecision
    totalKeywordRecall += keywordRecall
  }

  console.log('\n=== 汇总 ===')
  console.log(`平均文件精准率: ${((totalFilePrecision / totalTasks) * 100).toFixed(1)}%`)
  console.log(`平均文件召回率: ${((totalFileRecall / totalTasks) * 100).toFixed(1)}%`)
  console.log(`平均关键词精准率: ${((totalKeywordPrecision / totalTasks) * 100).toFixed(1)}%`)
  console.log(`平均关键词召回率: ${((totalKeywordRecall / totalTasks) * 100).toFixed(1)}%`)
}

runBenchmark().catch(console.error)
