import { bold, dim, red, UserFacingError, yellow } from './errors.js'
import { openInBrowser } from './browser.js'
import { createStudioRequestHandler } from './handler.js'
import { createPostgresExecutor } from './postgres-executor.js'
import { resolveStudioPort } from './ports.js'
import { resolveAllowedOrigins, resolveCredentials, resolveDatabaseUrl, type ConfiguredValue } from './config.js'
import { createStudioAuthService } from './auth.js'
import { startStudioServer } from './server.js'
import type { StudioAdapterType } from './studio-frontend-shared.js'

/** 由构建脚本通过 esbuild define 注入 */
declare const __STUDIO_CORE_VERSION__: string

const CLI_NAME = 'prisma-studio-zh'

interface StudioArgs {
  help?: boolean
  port?: number
  browser?: string
  config?: string
  url?: string
}

function main(): void {
  void run()
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)

  if (args instanceof Error) {
    fail(args)
    return
  }

  if (args.help) {
    console.log(createHelp())
    return
  }

  try {
    await start(args)
  } catch (error) {
    if (error instanceof UserFacingError) {
      fail(error)
      return
    }

    throw error
  }
}

async function start(args: StudioArgs): Promise<void> {
  if (args.port !== undefined && (!Number.isInteger(args.port) || args.port < 1 || args.port > 65_535)) {
    throw new UserFacingError('Studio 端口必须是 1 到 65535 之间的整数。')
  }

  // 登录凭据是硬性要求:未配置用户名或密码时直接拒绝启动
  const { username, password } = await resolveCredentials({ config: args.config })

  if (username === undefined || password === undefined) {
    throw new UserFacingError(createMissingCredentialsMessage(username, password))
  }

  const resolved = await resolveDatabaseUrl({ url: args.url, config: args.config })
  const connectionString = resolved.url

  if (!connectionString) {
    throw new UserFacingError(
      '未找到数据库连接串。请通过 --url <连接串> 提供,或创建 prisma-studio.config.json 配置文件,或设置 DATABASE_URL 环境变量。',
    )
  }

  const protocol = connectionString.split('://')[0]?.toLowerCase() ?? ''

  if (protocol === 'prisma' || protocol === 'prisma+postgres') {
    throw new UserFacingError(
      'Prisma Studio 已不再支持 Accelerate 连接串(prisma:// 或 prisma+postgres://),请使用直连数据库的连接串。',
    )
  }

  if (protocol !== 'postgres' && protocol !== 'postgresql') {
    throw new UserFacingError(
      `中文版仅支持 PostgreSQL 连接(postgres:// 或 postgresql://),当前协议为 "${protocol}"。`,
    )
  }

  if (!URL.canParse(connectionString)) {
    throw new UserFacingError('提供的数据库连接串无效。')
  }

  const executor = await createPostgresExecutor(connectionString)
  const port = await resolveStudioPort(args.port)

  const auth = createStudioAuthService({ username: username.value, password: password.value })

  // 同源检查的白名单:本机两种写法始终放行,反代透传 Host 的域名访问无需配置,
  // 这里再并上用户显式声明的 allowedOrigins(兜底 Host 被改写的部署方式)
  const allowedOrigins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    ...(await resolveAllowedOrigins({ config: args.config })),
  ]

  const handler = createStudioRequestHandler({
    adapter: 'postgres' satisfies StudioAdapterType,
    allowedOrigins,
    auth,
    executor,
    connectionString,
  })

  const url = `http://localhost:${port}`

  const server = startStudioServer({
    handler,
    onListen: () => {
      console.log(bold(`\nPrisma Studio 中文版已启动:`), url)
      console.log(dim(`  数据库:${maskUrlPassword(connectionString)}(来源:${resolved.source})`))
      console.log(dim(`  登录账号:${username.value}(来源:${username.source})`))
      console.log(dim(`  登录密码:已通过${password.source}配置`))
      console.log(dim(`  界面引擎:@prisma/studio-core v${__STUDIO_CORE_VERSION__}`))
      console.log(dim('  按 Ctrl+C 退出'))

      openInBrowser(url, args.browser)
    },
    port,
  })

  process.once('SIGINT', () => server.close())
  process.once('SIGTERM', () => server.close())
}

function parseArgs(argv: string[]): StudioArgs | Error {
  const args: StudioArgs = {}

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]!

    if (!token.startsWith('-')) {
      return new Error(`无法识别的参数 "${token}",请使用 --help 查看用法。`)
    }

    let name = token
    let value: string | undefined

    const equalsIndex = token.indexOf('=')

    if (equalsIndex !== -1) {
      name = token.slice(0, equalsIndex)
      value = token.slice(equalsIndex + 1)
    }

    switch (name) {
      case '-h':
      case '--help': {
        args.help = true
        break
      }
      case '-p':
      case '--port': {
        const parsed = readValue(name, value, argv, index)

        if (typeof parsed === 'string') {
          return new Error(parsed)
        }

        index = parsed.nextIndex
        args.port = Number(parsed.value)

        break
      }
      case '-b':
      case '--browser': {
        const parsed = readValue(name, value, argv, index)

        if (typeof parsed === 'string') {
          return new Error(parsed)
        }

        index = parsed.nextIndex
        args.browser = parsed.value

        break
      }
      case '--config': {
        const parsed = readValue(name, value, argv, index)

        if (typeof parsed === 'string') {
          return new Error(parsed)
        }

        index = parsed.nextIndex
        args.config = parsed.value

        break
      }
      case '--url': {
        const parsed = readValue(name, value, argv, index)

        if (typeof parsed === 'string') {
          return new Error(parsed)
        }

        index = parsed.nextIndex
        args.url = parsed.value

        break
      }
      default: {
        return new Error(`未知选项 "${name}",请使用 --help 查看用法。`)
      }
    }
  }

  return args
}

function readValue(
  name: string,
  inlineValue: string | undefined,
  argv: string[],
  currentIndex: number,
): { value: string; nextIndex: number } | string {
  if (inlineValue !== undefined) {
    return { value: inlineValue, nextIndex: currentIndex }
  }

  const nextValue = argv[currentIndex + 1]

  if (nextValue === undefined || nextValue.startsWith('-')) {
    return `选项 "${name}" 需要一个值。`
  }

  return { value: nextValue, nextIndex: currentIndex + 1 }
}

function createHelp(): string {
  return `
使用 Prisma Studio 中文版浏览您的 PostgreSQL 数据

${bold('用法')}

  ${dim('$')} ${CLI_NAME} [选项]

${bold('选项')}

  -h, --help        显示此帮助信息
  -p, --port        指定 Studio 监听端口
  -b, --browser     指定打开 Studio 的浏览器(设为 none 则不打开)
  --config          自定义 JSON 配置文件路径
  --url             PostgreSQL 数据库连接串(优先级最高)

${bold('数据库连接串来源(按优先级排序)')}

  1. --url 命令行参数
  2. --config 指定的 JSON 配置文件(格式:{ "url": "postgresql://..." })
  3. 当前目录下的 prisma-studio.config.json
  4. 当前目录下 prisma.config.ts 中字面量书写的连接串
  5. DATABASE_URL 环境变量

${bold('登录凭据(必须配置,否则拒绝启动)')}

  环境变量(优先):STUDIO_USERNAME 与 STUDIO_PASSWORD
  配置文件:JSON 配置中的 "username" 与 "password" 字段
  未登录时,页面与所有数据接口均被拒绝访问

${bold('反向代理 / 跨域')}

  同源请求与域名反代(Host 透传)默认即可访问;
  需要额外放行域名时,设置 STUDIO_ALLOWED_ORIGINS 环境变量(逗号分隔)
  或在 JSON 配置中加入 "allowedOrigins": ["https://example.com"]

${bold('示例')}

  使用默认端口启动
    ${dim('$')} ${CLI_NAME}

  使用自定义端口启动
    ${dim('$')} ${CLI_NAME} --port 5555

  使用指定的浏览器打开
    ${dim('$')} ${CLI_NAME} --port 5555 --browser firefox

  不自动打开浏览器
    ${dim('$')} ${CLI_NAME} --port 5555 --browser none

  指定数据库连接串
    ${dim('$')} ${CLI_NAME} --url="postgresql://user:password@localhost:5432/dbname"
`.trimStart()
}

/** 在终端展示时隐藏连接串中的密码。 */
function maskUrlPassword(connectionString: string): string {
  try {
    const url = new URL(connectionString)

    if (url.password) {
      url.password = '***'
    }

    return url.toString()
  } catch {
    return connectionString
  }
}

/** 生成登录凭据缺失时的启动报错信息。 */
function createMissingCredentialsMessage(
  username: ConfiguredValue | undefined,
  password: ConfiguredValue | undefined,
): string {
  const missing = [
    username === undefined ? '用户名(username)' : null,
    password === undefined ? '密码(password)' : null,
  ]
    .filter(Boolean)
    .join('和')

  return (
    `未配置登录${missing}。Prisma Studio 中文版必须配置登录凭据后才能启动,支持以下两种方式(环境变量优先于配置文件):\n\n` +
    `  方式一:环境变量\n` +
    `    STUDIO_USERNAME   登录用户名\n` +
    `    STUDIO_PASSWORD   登录密码\n\n` +
    `  方式二:JSON 配置文件\n` +
    `    在 --config 指定的文件或当前目录的 prisma-studio.config.json 中加入:\n` +
    `    { "username": "登录用户名", "password": "登录密码" }`
  )
}

function fail(error: Error): void {
  console.error(`\n${bold(red('!'))} ${yellow(error.message)}`)
  process.exitCode = 1
}

main()
