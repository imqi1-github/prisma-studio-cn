import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * 数据库连接串解析顺序(均为本地零依赖实现,替代 @prisma/config):
 *
 * 1. `--url <连接串>` 命令行参数
 * 2. `--config <文件>` 指定的 JSON 配置文件
 * 3. 当前目录的 `prisma-studio.config.json`
 * 4. `prisma.config.ts` / `prisma7.config.ts` 中以字面量形式书写的 PostgreSQL 连接串
 * 5. `DATABASE_URL` 环境变量
 *
 * 登录凭据(username / password)按以下优先级解析:
 * 1. `STUDIO_USERNAME` / `STUDIO_PASSWORD` 环境变量
 * 2. JSON 配置文件中的 `username` / `password` 字段
 */

const JSON_CONFIG_CANDIDATES = ['prisma-studio.config.json'] as const

const TS_CONFIG_CANDIDATES = ['prisma.config.ts', 'prisma7.config.ts'] as const

const POSTGRES_URL_PATTERN = /['"](postgres(?:ql)?:\/\/[^\s'"]+)['"]/

export interface ResolvedDatabaseUrl {
  url: string | undefined
  source: '命令行参数' | '配置文件' | '环境变量' | '无'
  configFile: string | null
}

export interface ConfiguredValue {
  value: string
  source: '环境变量' | '配置文件'
}

export interface ResolvedCredentials {
  username: ConfiguredValue | undefined
  password: ConfiguredValue | undefined
}

export async function resolveDatabaseUrl(options: {
  url?: string
  config?: string
}): Promise<ResolvedDatabaseUrl> {
  if (options.url) {
    return { url: options.url, source: '命令行参数', configFile: null }
  }

  if (options.config) {
    const url = await readUrlFromJsonConfig(resolve(options.config))

    if (url) {
      return { url, source: '配置文件', configFile: resolve(options.config) }
    }

    return { url: undefined, source: '无', configFile: resolve(options.config) }
  }

  for (const candidate of JSON_CONFIG_CANDIDATES) {
    const filePath = resolve(candidate)
    const url = await readUrlFromJsonConfig(filePath)

    if (url) {
      return { url, source: '配置文件', configFile: filePath }
    }
  }

  for (const candidate of TS_CONFIG_CANDIDATES) {
    const filePath = resolve(candidate)
    const url = await readUrlFromTsConfig(filePath)

    if (url) {
      return { url, source: '配置文件', configFile: filePath }
    }
  }

  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: '环境变量', configFile: null }
  }

  return { url: undefined, source: '无', configFile: null }
}

/**
 * 解析登录凭据:环境变量(STUDIO_USERNAME / STUDIO_PASSWORD)优先于 JSON 配置文件。
 * 用户名与密码各自独立解析,但两者必须同时存在 CLI 才会启动。
 */
export async function resolveCredentials(options: { config?: string }): Promise<ResolvedCredentials> {
  const configPaths = options.config
    ? [resolve(options.config)]
    : JSON_CONFIG_CANDIDATES.map((candidate) => resolve(candidate))

  let configUsername: ConfiguredValue | undefined
  let configPassword: ConfiguredValue | undefined

  for (const filePath of configPaths) {
    const { exists, record } = await readJsonConfig(filePath)

    if (!exists) {
      continue
    }

    if (typeof record['username'] === 'string') {
      configUsername = { value: record['username'], source: '配置文件' }
    }

    if (typeof record['password'] === 'string') {
      configPassword = { value: record['password'], source: '配置文件' }
    }

    // 与连接串解析保持一致:只读取第一个存在的 JSON 配置文件
    break
  }

  return {
    username: process.env.STUDIO_USERNAME
      ? { value: process.env.STUDIO_USERNAME, source: '环境变量' }
      : configUsername,
    password: process.env.STUDIO_PASSWORD
      ? { value: process.env.STUDIO_PASSWORD, source: '环境变量' }
      : configPassword,
  }
}

interface JsonConfig {
  /** 配置文件是否存在(可读)。 */
  exists: boolean
  /** 文件解析出的顶层对象;文件不存在或内容不是对象时为空对象。 */
  record: Record<string, unknown>
}

async function readJsonConfig(filePath: string): Promise<JsonConfig> {
  let content: string

  try {
    content = await readFile(filePath, 'utf8')
  } catch {
    return { exists: false, record: {} }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(`配置文件 "${filePath}" 不是有效的 JSON:${(error as Error).message}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { exists: true, record: {} }
  }

  return { exists: true, record: parsed as Record<string, unknown> }
}

async function readUrlFromJsonConfig(filePath: string): Promise<string | undefined> {
  const { record } = await readJsonConfig(filePath)

  if (typeof record['url'] === 'string') {
    return record['url']
  }

  const datasource = record['datasource']

  if (typeof datasource === 'object' && datasource !== null && typeof (datasource as Record<string, unknown>)['url'] === 'string') {
    return (datasource as Record<string, unknown>)['url'] as string
  }

  return undefined
}

/**
 * 以纯文本方式从 prisma.config.ts 中提取字面量书写的 PostgreSQL 连接串。
 * 支持形如 `url: 'postgresql://...'` 的写法;若连接串来自环境变量,请改用
 * `--url` 参数或 `DATABASE_URL` 环境变量。
 */
async function readUrlFromTsConfig(filePath: string): Promise<string | undefined> {
  let content: string

  try {
    content = await readFile(filePath, 'utf8')
  } catch {
    return undefined
  }

  const match = POSTGRES_URL_PATTERN.exec(content)

  return match?.[1]
}
