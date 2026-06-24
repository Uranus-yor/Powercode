#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// 使用 tsx 运行 TypeScript
const tsxPath = join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const entryPoint = join(projectRoot, 'src', 'index.ts')

const child = spawn('node', [tsxPath, entryPoint, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
