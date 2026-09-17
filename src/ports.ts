import { createServer } from 'node:net'

import { STUDIO_SERVER_HOST } from './server.js'

/**
 * `prisma dev` 的 `51_213 - 1`
 */
export const DEFAULT_PORT = 51_212

export const MIN_PORT = 49_152

/** 检测 127.0.0.1 上的某个端口是否可用(替代 get-port-please 依赖)。 */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, STUDIO_SERVER_HOST)
  })
}

/**
 * 解析 Studio 端口:显式指定时原样使用(与原版行为一致,占用时由监听报错);
 * 未指定时从默认端口开始向下扫描。
 */
export async function resolveStudioPort(requestedPort: number | undefined): Promise<number> {
  if (requestedPort !== undefined) {
    return requestedPort
  }

  for (let port = DEFAULT_PORT; port >= MIN_PORT; port--) {
    if (await isPortFree(port)) {
      return port
    }
  }

  throw new Error(`在 ${MIN_PORT}–${DEFAULT_PORT} 范围内未找到可用端口,请通过 --port 手动指定。`)
}
