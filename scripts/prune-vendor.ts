import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 根据 build/metafile.json 中实际打包的模块,删除 vendor/node_modules 里没被用到的包,
 * 让仓库只保留真正需要的第三方代码。
 */

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR_NODE_MODULES = path.join(ROOT_DIR, 'vendor', 'node_modules')
const METAFILE_PATH = path.join(ROOT_DIR, 'build', 'metafile.json')

interface Metafile {
  inputs: Record<string, unknown>
}

function collectUsedPackages(): Set<string> {
  const metafile = JSON.parse(fs.readFileSync(METAFILE_PATH, 'utf8')) as {
    cli?: Metafile
    frontend?: Metafile
  }

  const used = new Set<string>()

  const consider = (inputPath: string): void => {
    const normalized = inputPath.replaceAll('\\', '/')

    if (!normalized.startsWith('vendor/node_modules/')) {
      return
    }

    const relative = normalized.slice('vendor/node_modules/'.length)
    const segments = relative.split('/')
    const packageName = segments[0]!.startsWith('@')
      ? `${segments[0]}/${segments[1]}`
      : segments[0]!

    used.add(packageName)
  }

  for (const inputs of [metafile.cli?.inputs, metafile.frontend?.inputs]) {
    if (inputs === undefined) {
      continue
    }

    Object.keys(inputs).forEach(consider)
  }

  return used
}

function listVendorPackages(): string[] {
  const packages: string[] = []

  for (const entry of fs.readdirSync(VENDOR_NODE_MODULES, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue
    }

    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(VENDOR_NODE_MODULES, entry.name)

      for (const scoped of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (scoped.isDirectory()) {
          packages.push(`${entry.name}/${scoped.name}`)
        }
      }
    } else {
      packages.push(entry.name)
    }
  }

  return packages
}

const used = collectUsedPackages()
const all = listVendorPackages()
const unused = all.filter((packageName) => !used.has(packageName))

for (const packageName of unused) {
  console.log(`删除未使用: ${packageName}`)
  fs.rmSync(path.join(VENDOR_NODE_MODULES, packageName), { recursive: true, force: true })
}

console.log(`\n保留 ${used.size} 个包,删除 ${unused.length} 个未使用的包。`)
