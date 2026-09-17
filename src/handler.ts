import { readFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Executor, SequenceExecutor } from '@prisma/studio-core/data'
import { type SerializedError, serializeError, type StudioBFFRequest } from '@prisma/studio-core/data/bff'

import { SESSION_COOKIE_NAME, type StudioAuthService } from './auth.js'
import { handleDbAdminApi } from './db-admin.js'
import { getDatabaseDashboardHtml } from './db-dashboard-page.js'
import {
  STUDIO_CSS_FILE_NAME,
  STUDIO_JS_FILE_NAME,
  type StudioAdapterType,
} from './studio-frontend-shared.js'

const FILE_EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.html': 'text/html',
}

const UNAUTHORIZED_MESSAGE = '未登录或会话已过期,请刷新页面重新登录。'

const PRISMA_LOGO_SVG = `<svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M0.396923 8.8719C0.25789 9.09869 0.260041 9.38484 0.402469 9.60951L2.98037 13.6761C3.14768 13.94 3.47018 14.0603 3.76949 13.9705L11.2087 11.7388C11.6147 11.617 11.8189 11.1641 11.6415 10.7792L6.8592 0.405309C6.62598 -0.100601 5.92291 -0.142128 5.63176 0.332808L0.396923 8.8719ZM6.73214 2.77688C6.6305 2.54169 6.2863 2.57792 6.23585 2.82912L4.3947 11.9965C4.35588 12.1898 4.53686 12.3549 4.72578 12.2985L9.86568 10.7642C10.0157 10.7194 10.093 10.5537 10.0309 10.41L6.73214 2.77688Z"
    fill="currentColor"
  />
</svg>`
const PRISMA_LOGO_SVG_DATA_URL = `data:image/svg+xml,${encodeURIComponent(PRISMA_LOGO_SVG)}`

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

// prettier-ignore
function getIndexHtml(adapter: StudioAdapterType): string {
  return `<!doctype html>
<html lang="zh-CN" style="height: 100%">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Prisma Studio(中文版)</title>
    <link rel="icon" href="${PRISMA_LOGO_SVG_DATA_URL}" type="image/svg+xml">
    <link rel="stylesheet" href="/${STUDIO_CSS_FILE_NAME}">
    <style>
      html {
        height: 100%;
      }

      body {
        color: black;
        height: 100%;
        margin: 0;
        padding: 0;
      }

      #root {
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__STUDIO_CONFIG__ = ${JSON.stringify({ adapter })};</script>
    <script type="module" src="/${STUDIO_JS_FILE_NAME}"></script>
  </body>
</html>`
}

/**
 * 未登录时展示的登录页。提交后由 POST /login 校验并下发会话 Cookie,
 * 成功后刷新页面进入 Studio。
 *
 * 配色取自 studio.css 的主题变量(.ps / .ps.dark),通过 prefers-color-scheme
 * 跟随系统深浅色,与登录后的 Studio 界面保持一致;不做手动切换按钮。
 */
// prettier-ignore
function getLoginHtml(): string {
  return `<!doctype html>
<html lang="zh-CN" style="height: 100%">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>登录 · Prisma Studio(中文版)</title>
    <link rel="icon" href="${PRISMA_LOGO_SVG_DATA_URL}" type="image/svg+xml">
    <style>
      :root {
        color-scheme: light;
        --radius: 0.5rem;
        --background: oklch(1 0 0);
        --foreground: oklch(0.141 0.005 285.823);
        --card: oklch(1 0 0);
        --border: oklch(0.92 0.004 286.32);
        --input: oklch(0.92 0.004 286.32);
        --ring: oklch(0.705 0.015 286.067);
        --muted-foreground: oklch(0.552 0.016 285.938);
        --primary: oklch(0.64 0.1423 268.56);
        --primary-foreground: oklch(0.985 0 0);
        --destructive: oklch(0.577 0.245 27.325);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color-scheme: dark;
          --background: oklch(0.141 0.005 285.823);
          --foreground: oklch(0.985 0 0);
          --card: oklch(0.21 0.006 285.885);
          --border: oklch(1 0 0 / 10%);
          --input: oklch(1 0 0 / 15%);
          --ring: oklch(0.552 0.016 285.938);
          --muted-foreground: oklch(0.705 0.015 286.067);
          --primary-foreground: oklch(0.21 0.006 285.885);
          --destructive: oklch(0.704 0.191 22.216);
        }
      }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background);
        color: var(--foreground);
        font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', Roboto, sans-serif;
      }
      .card {
        width: 340px;
        padding: 36px 32px 32px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) + 4px);
        box-shadow: 0 16px 48px oklch(0 0 0 / 12%);
      }
      .logo { color: var(--foreground); margin-bottom: 16px; }
      .logo svg { width: 28px; height: 33px; display: block; }
      h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
      h1 span { color: var(--primary); }
      p.subtitle { margin: 0 0 24px; color: var(--muted-foreground); font-size: 13px; }
      .error {
        display: none;
        margin: 0 0 16px;
        padding: 8px 12px;
        background: color-mix(in oklab, var(--destructive) 10%, transparent);
        border: 1px solid color-mix(in oklab, var(--destructive) 45%, transparent);
        border-radius: var(--radius);
        color: var(--destructive);
        font-size: 13px;
      }
      .error.visible { display: block; }
      label { display: block; margin-bottom: 16px; font-size: 13px; }
      input {
        width: 100%;
        margin-top: 6px;
        padding: 9px 12px;
        background: transparent;
        color: var(--foreground);
        border: 1px solid var(--input);
        border-radius: var(--radius);
        font-size: 14px;
        outline: none;
      }
      input:focus { border-color: var(--ring); }
      button {
        width: 100%;
        padding: 10px 0;
        margin-top: 4px;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: var(--radius);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover { background: color-mix(in oklab, var(--primary) 90%, transparent); }
      button:disabled { opacity: 0.6; cursor: default; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="logo">${PRISMA_LOGO_SVG}</div>
      <h1>Prisma Studio <span>中文版</span></h1>
      <p class="subtitle">请登录后继续访问</p>
      <p id="error" class="error" role="alert"></p>
      <form id="login-form">
        <label for="username">用户名
          <input id="username" name="username" autocomplete="username" autofocus required />
        </label>
        <label for="password">密码
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </label>
        <button id="submit" type="submit">登 录</button>
      </form>
    </main>
    <script>
      var form = document.getElementById('login-form')
      var errorBox = document.getElementById('error')
      var button = document.getElementById('submit')

      form.addEventListener('submit', function (event) {
        event.preventDefault()
        errorBox.classList.remove('visible')
        button.disabled = true

        fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
          }),
        }).then(function (response) {
          if (response.ok) {
            window.location.reload()
            return
          }

          errorBox.textContent =
            response.status === 401
              ? '用户名或密码错误。'
              : response.status === 403
                ? '当前地址被服务器拒绝,若通过域名反向代理访问,请在配置文件的 allowedOrigins 中加入站点域名。'
                : '登录失败,请稍后重试。'
          errorBox.classList.add('visible')
        }).catch(function () {
          errorBox.textContent = '网络错误,请稍后重试。'
          errorBox.classList.add('visible')
        }).finally(function () {
          button.disabled = false
        })
      })
    </script>
  </body>
</html>`
}

function isGetOrHeadRequest(method: string): boolean {
  return method === 'GET' || method === 'HEAD'
}

/** 按文件扩展名取 Content-Type;未知扩展名回退到二进制流。 */
function contentTypeFor(fileName: string): string {
  return FILE_EXTENSION_TO_CONTENT_TYPE[extname(fileName)] ?? 'application/octet-stream'
}

export function createStudioRequestHandler({
  adapter,
  auth,
  executor,
  allowedOrigins,
  connectionString,
}: {
  adapter: StudioAdapterType
  auth: StudioAuthService
  executor: Executor
  /** 除本机地址外额外放行的 Origin,由 CLI 从环境变量与配置文件解析 */
  allowedOrigins: readonly string[]
  /** 数据库连接串,供「数据库」看板的只读接口(/db-api)使用 */
  connectionString: string
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isAllowedStudioOrigin(request, allowedOrigins)) {
      return textResponse('禁止访问', 403)
    }

    const { pathname } = new URL(request.url)

    // 登录页也需要站点图标,favicon 保持公开
    if (isGetOrHeadRequest(request.method) && pathname === '/favicon.ico') {
      return textResponse(PRISMA_LOGO_SVG, 200, { 'Content-Type': 'image/svg+xml' })
    }

    if (request.method === 'POST' && pathname === '/login') {
      return handleLoginRequest(request, auth)
    }

    if (request.method === 'POST' && pathname === '/logout') {
      return handleLogoutRequest(request, auth)
    }

    // —— 以下所有路由均要求已登录 ——
    const token = readSessionToken(request)

    if (token === undefined || !auth.hasSession(token)) {
      if (isGetOrHeadRequest(request.method) && pathname === '/') {
        return textResponse(getLoginHtml(), 200, { 'Content-Type': contentTypeFor('login.html') })
      }

      return textResponse(UNAUTHORIZED_MESSAGE, 401)
    }

    if (isGetOrHeadRequest(request.method) && pathname === '/') {
      return textResponse(getIndexHtml(adapter), 200, { 'Content-Type': contentTypeFor('index.html') })
    }

    if (
      isGetOrHeadRequest(request.method) &&
      (pathname === `/${STUDIO_JS_FILE_NAME}` || pathname === `/${STUDIO_CSS_FILE_NAME}`)
    ) {
      return serveStudioAsset(pathname)
    }

    // 「数据库」看板页:由前端通过 iframe 挂载(见 frontend/database-panel.ts)
    if (isGetOrHeadRequest(request.method) && pathname === '/db-dashboard') {
      return textResponse(getDatabaseDashboardHtml(), 200, { 'Content-Type': contentTypeFor('index.html') })
    }

    if (request.method === 'POST' && pathname.startsWith('/db-api/')) {
      const action = pathname.slice('/db-api/'.length)
      const payload = await request.json().catch(() => undefined)

      return (await handleDbAdminApi(action, payload, connectionString)) ?? textResponse('未找到', 404)
    }

    if (request.method === 'POST' && pathname === '/bff') {
      return handleStudioBffRequest(await request.json(), executor)
    }

    if (request.method === 'POST' && pathname === '/telemetry') {
      // 中文版已移除遥测上报,直接返回成功
      return emptyResponse(200)
    }

    return textResponse('未找到', 404)
  }
}

async function handleLoginRequest(request: Request, auth: StudioAuthService): Promise<Response> {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return textResponse('请求体不是有效的 JSON。', 400)
  }

  const username = isRecord(payload) && typeof payload['username'] === 'string' ? payload['username'] : ''
  const password = isRecord(payload) && typeof payload['password'] === 'string' ? payload['password'] : ''

  if (!auth.verify({ username, password })) {
    // 轻微延迟,提高暴力破解的成本
    await sleep(500)
    return textResponse('用户名或密码错误。', 401)
  }

  return textResponse('登录成功。', 200, { 'Set-Cookie': auth.sessionCookie(auth.createSession()) })
}

function handleLogoutRequest(request: Request, auth: StudioAuthService): Response {
  const token = readSessionToken(request)

  if (token !== undefined) {
    auth.removeSession(token)
  }

  return textResponse('已退出登录。', 200, { 'Set-Cookie': auth.expiredSessionCookie() })
}

function readSessionToken(request: Request): string | undefined {
  const cookieHeader = request.headers.get('Cookie')

  if (cookieHeader === null) {
    return undefined
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')

    if (separator === -1) {
      continue
    }

    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()

    if (name === SESSION_COOKIE_NAME && value !== '') {
      return value
    }
  }

  return undefined
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function handleStudioBffRequest(payload: unknown, executor: Executor): Promise<Response> {
  const request = payload as StudioBFFRequest
  const { procedure } = request

  if (procedure === 'query') {
    const [error, results] = await executor.execute(request.query)

    if (error) {
      return jsonResponse([serializeBffError(error)])
    }

    return jsonResponse([null, results])
  }

  if (procedure === 'sequence') {
    if (!('executeSequence' in executor)) {
      return jsonResponse([[serializeBffError(new Error('执行器不支持序列操作'))]])
    }

    const [[error0, result0], maybeResult1] = await (executor as SequenceExecutor).executeSequence(request.sequence)

    if (error0) {
      return jsonResponse([[serializeBffError(error0)]])
    }

    const [error1, result1] = maybeResult1 || []

    if (error1) {
      return jsonResponse([[null, result0], [serializeBffError(error1)]])
    }

    return jsonResponse([
      [null, result0],
      [null, result1],
    ])
  }

  if (procedure === 'transaction') {
    if (!executor.executeTransaction) {
      return jsonResponse([serializeBffError(new Error('执行器不支持事务'))])
    }

    const [error, results] = await executor.executeTransaction(request.queries)

    if (error) {
      return jsonResponse([serializeBffError(error)])
    }

    return jsonResponse([null, results])
  }

  if (procedure === 'sql-lint') {
    if (!executor.lintSql) {
      return jsonResponse([serializeBffError(new Error('执行器不支持 SQL 检查'))])
    }

    const [error, result] = await executor.lintSql({
      schemaVersion: request.schemaVersion,
      sql: request.sql,
    })

    if (error) {
      return jsonResponse([serializeBffError(error)])
    }

    return jsonResponse([null, result])
  }

  if (procedure === 'query-insights') {
    return jsonResponse([serializeError(new Error('执行器不支持查询洞察'))])
  }

  procedure satisfies undefined

  return textResponse('未知的过程', 500)
}

async function serveStudioAsset(requestPath: string): Promise<Response> {
  const fileName = requestPath.substring(1)

  try {
    // 包一层 Uint8Array 以满足 BodyInit 的类型要求(Buffer 的泛型形参与 DOM 类型不兼容)
    return new Response(new Uint8Array(await readStudioAsset(fileName)), {
      headers: { 'Content-Type': contentTypeFor(fileName) },
      status: 200,
    })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return textResponse(`Prisma Studio 前端资源 "${fileName}" 未找到,请先运行 npm run build 构建。`, 404)
    }

    return textResponse('服务器内部错误', 500)
  }
}

async function readStudioAsset(fileName: string): Promise<Buffer> {
  const filePath = join(SCRIPT_DIR, fileName)

  try {
    return await readFile(filePath)
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      throw error
    }

    const errorWithCode = new Error(`Prisma Studio 前端资源 "${fileName}" 未找到。`) as Error & { code?: string }
    errorWithCode.code = 'ENOENT'
    errorWithCode.message = `${errorWithCode.message}\n已查找:${filePath}`
    throw errorWithCode
  }
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function serializeBffError(error: unknown): SerializedError {
  return getSerializedBffError(error) ?? serializeError(error)
}

function getSerializedBffError(error: unknown): SerializedError | null {
  if (isSerializedError(error)) {
    return error
  }

  // 用显式类型的局部变量承接,避免类型收窄把 Record<string, unknown>
  // 排除成 never(它可赋值给 SerializedError,会在谓词的假分支中被剔除)
  const record: Record<string, unknown> | undefined = isRecord(error) ? error : undefined

  if (record === undefined) {
    return null
  }

  const nestedError = record['error']

  if (isSerializedError(nestedError)) {
    return nestedError
  }

  const rpcSerializedError = record['@@error']

  if (isSerializedError(rpcSerializedError)) {
    return rpcSerializedError
  }

  return null
}

function isSerializedError(error: unknown): error is SerializedError {
  if (!isRecord(error)) {
    return false
  }

  if (typeof error.name !== 'string' || typeof error.message !== 'string') {
    return false
  }

  if (error.errors === undefined) {
    return true
  }

  return Array.isArray(error.errors) && error.errors.every(isSerializedError)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function jsonResponse(payload: unknown): Response {
  return Response.json(payload)
}

function emptyResponse(status: number, headers?: Record<string, string>): Response {
  return new Response(null, { headers, status })
}

function textResponse(text: string, status: number, headers?: Record<string, string>): Response {
  return new Response(text, {
    headers,
    status,
  })
}

/**
 * 同源检查,充当 CSRF 防护层:浏览器在跨站请求上会携带 Origin 头,
 * 与本服务不一致时拒绝全部写操作。
 *
 * 放行情形:
 * 1. 无 Origin 头(curl、页面导航等非浏览器跨站场景);
 * 2. Origin 的 host 与请求头 Host 一致 —— 本地直接访问与任意域名的反向代理
 *    (nginx/宝塔默认透传 Host)都走这条,因此生产环境无需额外配置;
 * 3. Origin 在 allowedOrigins 显式名单内(含本机 localhost/127.0.0.1 地址,
 *    兜底 Host 被反代改写的部署方式)。
 */
function isAllowedStudioOrigin(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get('Origin')

  if (origin === null) {
    return true
  }

  let originUrl: URL

  try {
    originUrl = new URL(origin)
  } catch {
    return false
  }

  const host = request.headers.get('Host')

  if (host !== null && originUrl.host === host) {
    return true
  }

  return allowedOrigins.includes(originUrl.origin)
}
