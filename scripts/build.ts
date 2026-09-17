import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

import { PATTERNS, TRANSLATIONS } from '../frontend/i18n/dictionary.js'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUILD_DIR = path.join(ROOT_DIR, 'build')
const VENDOR_NODE_MODULES = path.join(ROOT_DIR, 'vendor', 'node_modules')
const LODASH_DEBOUNCE_SHIM = path.join(ROOT_DIR, 'vendor', 'shims', 'lodash-debounce.js')

/** esbuild 解析 vendor 时共用的选项 */
const sharedResolve = {
  alias: {
    'lodash/debounce': LODASH_DEBOUNCE_SHIM,
  },
  nodePaths: [VENDOR_NODE_MODULES],
}

const require = createRequire(import.meta.url)

async function main(): Promise<void> {
  fs.mkdirSync(BUILD_DIR, { recursive: true })

  const studioCoreVersion = getStudioCoreVersion()

  // ---- 1. Node 端 CLI ----
  const cliResult = await build({
    banner: { js: '#!/usr/bin/env node\n' },
    bundle: true,
    define: {
      __STUDIO_CORE_VERSION__: JSON.stringify(studioCoreVersion),
    },
    entryPoints: [path.join(ROOT_DIR, 'src', 'cli.ts')],
    format: 'esm',
    metafile: true,
    minify: true,
    outfile: path.join(BUILD_DIR, 'cli.js'),
    platform: 'node',
    target: 'node20',
    ...sharedResolve,
  })

  chmodX(path.join(BUILD_DIR, 'cli.js'))

  // ---- 2. 浏览器端前端 ----
  const frontendResult = await build({
    bundle: true,
    entryPoints: [path.join(ROOT_DIR, 'frontend', 'entry.ts')],
    format: 'esm',
    metafile: true,
    minify: true,
    outfile: path.join(BUILD_DIR, 'studio.js'),
    platform: 'browser',
    target: 'es2022',
    ...sharedResolve,
  })

  // ---- 3. 样式 ----
  const cssSource = require.resolve('@prisma/studio-core/ui/index.css', { paths: [VENDOR_NODE_MODULES] })
  fs.copyFileSync(cssSource, path.join(BUILD_DIR, 'studio.css'))

  // ---- 4. 汉化补丁(构建期字符串替换) ----
  const frontendCode = fs.readFileSync(path.join(BUILD_DIR, 'studio.js'), 'utf8')
  const { code: patchedCode, applied, missed } = applyChinesePatch(frontendCode)
  fs.writeFileSync(path.join(BUILD_DIR, 'studio.js'), patchedCode, 'utf8')

  // ---- 5. 保存 metafile 供 vendor 精简脚本使用 ----
  const metafile = {
    cli: cliResult.metafile,
    frontend: frontendResult.metafile,
  }
  fs.writeFileSync(path.join(BUILD_DIR, 'metafile.json'), JSON.stringify(metafile, null, 2), 'utf8')

  console.log(`✔ 构建完成:`)
  console.log(`  build/cli.js     ${(fs.statSync(path.join(BUILD_DIR, 'cli.js')).size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  build/studio.js  ${(fs.statSync(path.join(BUILD_DIR, 'studio.js')).size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  build/studio.css ${(fs.statSync(path.join(BUILD_DIR, 'studio.css')).size / 1024).toFixed(1)} KB`)
  console.log(`  汉化:构建期替换 ${applied} 处;字典中未在 bundle 命中的词条 ${missed.size} 个`)

  if (missed.size > 0) {
    console.log(`  未命中词条(可能为运行时动态文本,已由 DOM 兜底覆盖):${[...missed].slice(0, 20).join('、')}`)
  }
}

/**
 * 把字典中的英文键替换为中文:仅匹配完整的字符串字面量(双引号/单引号)。
 *
 * 两类位置必须跳过,否则会改变程序语义:
 * 1. 后随 `:` 的字面量 — 对象键(包括汉化字典自身的键!)或 case 标签;
 * 2. 前置 `===`/`==`/`!=`/`!==`/`case` 的字面量 — 代码用来做比较的协议值,
 *    翻译它们会破坏功能(被跳过的这类显示文案由运行时 DOM 兜底翻译覆盖)。
 */
function applyChinesePatch(code: string): { code: string; applied: number; missed: Set<string> } {
  const missed = new Set<string>(Object.keys(TRANSLATIONS))
  let applied = 0

  const stringLiteralPattern = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g

  const patched = code.replace(
    stringLiteralPattern,
    (match, doubleQuoted: string | undefined, singleQuoted: string | undefined, offset: number, whole: string) => {
      const raw = doubleQuoted ?? singleQuoted

      if (raw === undefined) {
        return match
      }

      const decoded = decodeJsString(raw)
      const translated = TRANSLATIONS[decoded]

      if (translated === undefined) {
        return match
      }

      const after = whole.slice(offset + match.length, offset + match.length + 2)

      if (/^\s*:/.test(after)) {
        return match
      }

      const before = whole.slice(Math.max(0, offset - 6), offset)

      if (/(===|==|!==|!=|case\s*)$/.test(before)) {
        return match
      }

      applied++
      missed.delete(decoded)

      return JSON.stringify(translated)
    },
  )

  return { code: patched, applied, missed }
}

/** 解码 JS 字符串字面量中的转义序列(不带外层引号)。 */
function decodeJsString(raw: string): string {
  if (!raw.includes('\\')) {
    return raw
  }

  let result = ''

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]!

    if (char !== '\\') {
      result += char
      continue
    }

    const next = raw[++index]

    switch (next) {
      case 'n': result += '\n'; break
      case 't': result += '\t'; break
      case 'r': result += '\r'; break
      case 'b': result += '\b'; break
      case 'f': result += '\f'; break
      case 'v': result += '\v'; break
      case '0': result += '\0'; break
      case 'x': {
        result += String.fromCharCode(Number.parseInt(raw.slice(index + 1, index + 3), 16))
        index += 2
        break
      }
      case 'u': {
        if (raw[index + 1] === '{') {
          const end = raw.indexOf('}', index)
          result += String.fromCodePoint(Number.parseInt(raw.slice(index + 2, end), 16))
          index = end
        } else {
          result += String.fromCharCode(Number.parseInt(raw.slice(index + 1, index + 5), 16))
          index += 4
        }
        break
      }
      case '\n': break
      default: result += next ?? ''
    }
  }

  return result
}

function getStudioCoreVersion(): string {
  const packageJsonPath = path.join(VENDOR_NODE_MODULES, '@prisma', 'studio-core', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version: string }

  return packageJson.version
}

function chmodX(filePath: string): void {
  const stat = fs.statSync(filePath)
  const newMode = stat.mode | 0o755

  if (stat.mode !== newMode) {
    fs.chmodSync(filePath, newMode)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

// 引用 PATTERNS 以避免未使用告警(构建期补丁暂不使用正则规则,运行时兜底使用)
void PATTERNS
