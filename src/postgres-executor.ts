import type { Executor } from '@prisma/studio-core/data'
import { createPostgresJSExecutor } from '@prisma/studio-core/data/postgresjs'
import postgres from 'postgres'

/**
 * Prisma ORM 专属的连接串查询参数,传给 postgres 客户端前需要移除。
 *
 * @See https://www.prisma.io/docs/orm/overview/databases/postgresql#arguments
 * @See https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-PARAMKEYWORDS
 */
const PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'sslidentity',
  'sslaccept',
  'pool', // `postgres` 包使用连接池连接 PPG 会失败,暂时通过移除该参数禁用。参见 https://linear.app/prisma-company/issue/TML-1670。
  'socket_timeout',
  'pgbouncer',
  'statement_cache_size',
] as const

/** 创建基于 postgres.js 的 Studio 执行器。 */
export async function createPostgresExecutor(connectionString: string): Promise<Executor> {
  const connectionURL = new URL(connectionString)

  for (const queryParameter of PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS) {
    connectionURL.searchParams.delete(queryParameter)
  }

  const client = postgres(connectionURL.toString())

  process.once('SIGINT', () => client.end())
  process.once('SIGTERM', () => client.end())

  return createPostgresJSExecutor(client)
}
