import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 开发辅助工具:从打包产物 build/studio.js 中提取疑似界面文案的字符串字面量,
 * 输出到 build/ui-strings.txt,供编写汉化字典时参考。
 */

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CODE = fs.readFileSync(path.join(ROOT_DIR, 'build', 'studio.js'), 'utf8')

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

const occurrences = new Map<string, number>()

const pattern = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g

let match: RegExpExecArray | null

while ((match = pattern.exec(CODE)) !== null) {
  const raw = match[1] ?? match[2]

  if (raw === undefined) {
    continue
  }

  const decoded = decodeJsString(raw)

  // 过滤:保留「像界面文案」的字符串
  if (decoded.length < 2 || decoded.length > 80) {
    continue
  }

  if (!/[A-Za-z]/.test(decoded)) {
    continue
  }

  // 必须包含空格或以大写字母开头(排除普通标识符/协议词)
  const looksLikeUiText = /\s/.test(decoded) || /^[A-Z]/.test(decoded)

  if (!looksLikeUiText) {
    continue
  }

  // 排除明显的非文案:URL、文件名、CSS、代码片段
  if (/^(https?:|\/|\.|#|@|\w+\.(js|css|ts|json|md|wasm|svg|png))/i.test(decoded)) {
    continue
  }

  if (/[{};=<>]|=>|\bfunction\b|\bconst\b|\breturn\b/.test(decoded)) {
    continue
  }

  occurrences.set(decoded, (occurrences.get(decoded) ?? 0) + 1)
}

const sorted = [...occurrences.entries()].sort((a, b) => a[0].localeCompare(b[0]))

const lines = sorted.map(([text, count]) => `${String(count).padStart(3)}× ${JSON.stringify(text)}`)

fs.writeFileSync(path.join(ROOT_DIR, 'build', 'ui-strings.txt'), lines.join('\n'), 'utf8')

console.log(`共提取 ${sorted.length} 条候选文案 → build/ui-strings.txt`)
