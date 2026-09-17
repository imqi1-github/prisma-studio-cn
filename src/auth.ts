import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Studio 登录认证(零依赖实现):
 *
 * - 凭据在启动时由 CLI 从环境变量或配置文件解析后传入,进程内只保存其 SHA-256
 *   摘要,校验使用 timingSafeEqual 防止时序侧信道;
 * - 会话令牌为 32 字节随机数,保存在进程内存中(服务重启后需重新登录);
 * - Cookie 采用 HttpOnly + SameSite=Strict,配合 handler 中已有的同源校验抵御 CSRF。
 */

export const SESSION_COOKIE_NAME = 'studio_session'

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export interface StudioAuthService {
  /** 校验用户名与密码是否匹配(恒定时间比较)。 */
  verify(credentials: { username: string; password: string }): boolean
  /** 创建新会话并返回令牌。 */
  createSession(): string
  hasSession(token: string): boolean
  removeSession(token: string): void
  /** 已登录会话的 Set-Cookie 值。 */
  sessionCookie(token: string): string
  /** 注销用的过期 Set-Cookie 值。 */
  expiredSessionCookie(): string
}

export function createStudioAuthService({
  username,
  password,
}: {
  username: string
  password: string
}): StudioAuthService {
  const expectedUsernameDigest = sha256(username)
  const expectedPasswordDigest = sha256(password)
  const sessions = new Set<string>()

  return {
    verify({ username: inputUsername, password: inputPassword }) {
      return (
        safeEqual(expectedUsernameDigest, sha256(inputUsername)) &&
        safeEqual(expectedPasswordDigest, sha256(inputPassword))
      )
    },

    createSession() {
      const token = randomBytes(32).toString('hex')

      sessions.add(token)

      return token
    },

    hasSession(token) {
      return sessions.has(token)
    },

    removeSession(token) {
      sessions.delete(token)
    },

    sessionCookie(token) {
      return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    },

    expiredSessionCookie() {
      return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
    },
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}
