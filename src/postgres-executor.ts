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
  const client = postgres(toPostgresJsUrl(connectionString))

  process.once('SIGINT', () => client.end())
  process.once('SIGTERM', () => client.end())

  const executor = createPostgresJSExecutor(client)

  if (executor.lintSql === undefined) {
    return executor
  }

  const lintSql = executor.lintSql.bind(executor)

  return {
    ...executor,
    async lintSql(details, options) {
      // Studio core 的 SQL lint 只支持可 EXPLAIN 的 DML,会把 CREATE TABLE、
      // ALTER TABLE、CREATE INDEX、DO 等合法 PostgreSQL 语句提前拦掉。
      // 这些语句交给 PostgreSQL 执行,让数据库返回真实的语法/权限错误。
      if (containsSchemaChangingSql(details.sql)) {
        return [null, { diagnostics: [], schemaVersion: details.schemaVersion }]
      }

      return lintSql(details, options)
    },
  }
}

const SCHEMA_CHANGING_KEYWORDS = new Set([
  'alter',
  'analyze',
  'cluster',
  'comment',
  'create',
  'do',
  'drop',
  'grant',
  'refresh',
  'reindex',
  'revoke',
  'truncate',
  'vacuum',
])

type SqlScanMode = 'normal' | 'single-quote' | 'double-quote' | 'line-comment' | 'block-comment' | 'dollar-quote'

function containsSchemaChangingSql(sql: string): boolean {
  let mode: SqlScanMode = 'normal'
  let blockCommentDepth = 0
  let dollarQuoteDelimiter = ''
  let statementStart = 0

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? ''
    const nextChar = sql[index + 1]

    if (mode === 'single-quote') {
      if (char === "'" && nextChar === "'") {
        index += 1
        continue
      }

      if (char === "'") {
        mode = 'normal'
      }

      continue
    }

    if (mode === 'double-quote') {
      if (char === '"' && nextChar === '"') {
        index += 1
        continue
      }

      if (char === '"') {
        mode = 'normal'
      }

      continue
    }

    if (mode === 'line-comment') {
      if (char === '\n') {
        mode = 'normal'
      }

      continue
    }

    if (mode === 'block-comment') {
      if (char === '/' && nextChar === '*') {
        blockCommentDepth += 1
        index += 1
        continue
      }

      if (char === '*' && nextChar === '/') {
        blockCommentDepth -= 1
        index += 1

        if (blockCommentDepth === 0) {
          mode = 'normal'
        }
      }

      continue
    }

    if (mode === 'dollar-quote') {
      if (dollarQuoteDelimiter && sql.startsWith(dollarQuoteDelimiter, index)) {
        index += dollarQuoteDelimiter.length - 1
        dollarQuoteDelimiter = ''
        mode = 'normal'
      }

      continue
    }

    if (char === "'") {
      mode = 'single-quote'
      continue
    }

    if (char === '"') {
      mode = 'double-quote'
      continue
    }

    if (char === '-' && nextChar === '-') {
      mode = 'line-comment'
      index += 1
      continue
    }

    if (char === '/' && nextChar === '*') {
      mode = 'block-comment'
      blockCommentDepth = 1
      index += 1
      continue
    }

    if (char === '$') {
      const delimiter = readDollarQuoteDelimiter(sql, index)

      if (delimiter) {
        mode = 'dollar-quote'
        dollarQuoteDelimiter = delimiter
        index += delimiter.length - 1
        continue
      }
    }

    if (char === ';') {
      if (isSchemaChangingStatement(sql.slice(statementStart, index))) {
        return true
      }

      statementStart = index + 1
    }
  }

  return isSchemaChangingStatement(sql.slice(statementStart))
}

function isSchemaChangingStatement(statement: string): boolean {
  let remaining = statement.trimStart()

  while (remaining.length > 0) {
    if (remaining.startsWith('--')) {
      const newlineIndex = remaining.indexOf('\n')
      remaining = newlineIndex === -1 ? '' : remaining.slice(newlineIndex + 1).trimStart()
      continue
    }

    if (remaining.startsWith('/*')) {
      const commentEnd = remaining.indexOf('*/', 2)
      remaining = commentEnd === -1 ? '' : remaining.slice(commentEnd + 2).trimStart()
      continue
    }

    break
  }

  const firstKeyword = /^([A-Za-z_]+)/.exec(remaining)?.[1]?.toLowerCase()
  return firstKeyword !== undefined && SCHEMA_CHANGING_KEYWORDS.has(firstKeyword)
}

function readDollarQuoteDelimiter(sql: string, start: number): string | null {
  if (sql[start] !== '$') {
    return null
  }

  let index = start + 1

  while (index < sql.length) {
    const char = sql[index] ?? ''

    if (char === '$') {
      const delimiter = sql.slice(start, index + 1)

      if (delimiter === '$$' || /^\$[A-Za-z_][A-Za-z0-9_]*\$$/.test(delimiter)) {
        return delimiter
      }

      return null
    }

    if (!/[A-Za-z0-9_]/.test(char)) {
      return null
    }

    index += 1
  }

  return null
}

/**
 * 移除 Prisma ORM 专属查询参数,返回 postgres.js 可直接使用的连接串。
 * Studio 执行器与数据库看板共用。
 */
export function toPostgresJsUrl(connectionString: string): string {
  const connectionURL = new URL(connectionString)

  for (const queryParameter of PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS) {
    connectionURL.searchParams.delete(queryParameter)
  }

  return connectionURL.toString()
}
