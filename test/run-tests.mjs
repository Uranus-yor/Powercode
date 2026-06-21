import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

async function findTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await findTestFiles(fullPath)
      files.push(...subFiles)
    } else if (entry.name.endsWith('.test.ts')) {
      files.push(fullPath)
    }
  }
  return files
}

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const testDir = path.join(root, 'test')
const testFiles = (await findTestFiles(testDir)).sort()

if (testFiles.length === 0) {
  console.error('No test files found in test/*.test.ts')
  process.exit(1)
}

const child = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  { stdio: 'inherit' },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
