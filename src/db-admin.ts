import postgres from 'postgres'

import { toPostgresJsUrl } from './postgres-executor.js'

/**
 * 数据库看板:Studio 侧边栏「数据库」页签的数据来源(全部只读)。
 *
 * 查询只读系统目录(pg_database / pg_namespace / pg_extension 等)与
 * version() 等函数;标识符经 quoteIdent 转义后才允许拼进 SQL,
 * 其余输入一律走参数绑定。每次调用使用独立短连接,用完即关。
 */

export interface DatabaseOverview {
  name: string
  owner: string
  encoding: string
  collate: string
  ctype: string
  size: string
  connections: number
  connectionLimit: number
  allowConnect: boolean
  version: string
  schemas: Array<{ name: string; tables: number }>
  extensions: Array<{ name: string; version: string }>
}

export interface TableAdminInfo {
  schema: string
  table: string
  owner: string
  size: string
  comment: string | null
  estimatedRows: number | null
  columns: number
  indexes: number
}

export class DbAdminError extends Error {}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new DbAdminError(`缺少参数 ${key}。`)
  }

  return value.trim()
}

async function withClient<T>(databaseUrl: string, run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined })

  try {
    return await run(sql)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/** 当前连接的数据库概览:基本信息 + 非系统 Schema + 已安装扩展。 */
export async function getDatabaseOverview(connectionString: string): Promise<DatabaseOverview> {
  return withClient(toPostgresJsUrl(connectionString), async (sql) => {
    const [row] = await sql`
      SELECT current_database()               AS name,
             pg_get_userbyid(d.datdba)        AS owner,
             pg_encoding_to_char(d.encoding)  AS encoding,
             d.datcollate                     AS collate,
             d.datctype                       AS ctype,
             d.datallowconn                   AS allow_connect,
             d.datconnlimit::int              AS connection_limit,
             pg_size_pretty(pg_database_size(d.datname)) AS size,
             (SELECT count(*) FROM pg_stat_activity WHERE datname = d.datname AND pid <> pg_backend_pid())::int AS connections,
             version()                        AS version
      FROM pg_database d
      WHERE d.datname = current_database()
    `

    if (!row) {
      throw new DbAdminError('无法读取数据库信息。')
    }

    const schemaRows = await sql`
      SELECT n.nspname AS name,
             count(c.oid)::int AS tables
      FROM pg_namespace n
      LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind IN ('r', 'p')
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg\\_toast%'
        AND n.nspname NOT LIKE 'pg\\_temp%'
      GROUP BY n.nspname
      ORDER BY n.nspname
    `

    const extensionRows = await sql`
      SELECT extname    AS name,
             extversion AS version
      FROM pg_extension
      ORDER BY extname
    `

    return {
      name: String(row.name),
      owner: String(row.owner),
      encoding: String(row.encoding),
      collate: String(row.collate),
      ctype: String(row.ctype),
      size: String(row.size),
      connections: Number(row.connections),
      connectionLimit: Number(row.connection_limit),
      allowConnect: Boolean(row.allow_connect),
      version: String(row.version),
      schemas: schemaRows.map((schema) => ({ name: schema.name, tables: Number(schema.tables) })),
      extensions: extensionRows.map((extension) => ({
        name: extension.name,
        version: String(extension.version),
      })),
    }
  })
}

/** 非系统 Schema 下的全部数据表(基础信息 + 列数 / 索引数)。 */
export async function listTables(connectionString: string): Promise<TableAdminInfo[]> {
  return withClient(toPostgresJsUrl(connectionString), async (sql) => {
    const rows = await sql`
      SELECT n.nspname                                     AS schema,
             c.relname                                     AS table,
             pg_get_userbyid(c.relowner)                   AS owner,
             pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
             obj_description(c.oid, 'pg_class')            AS comment,
             c.reltuples::bigint                           AS estimated_rows,
             (SELECT count(*) FROM pg_attribute a
              WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)::int AS columns,
             (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid)::int AS indexes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg\\_toast%'
        AND n.nspname NOT LIKE 'pg\\_temp%'
      ORDER BY n.nspname, c.relname
    `

    return rows.map((row) => ({
      schema: row.schema,
      table: row.table,
      owner: row.owner,
      size: row.size,
      comment: typeof row.comment === 'string' ? row.comment : null,
      estimatedRows: row.estimated_rows === null ? null : Number(row.estimated_rows),
      columns: Number(row.columns),
      indexes: Number(row.indexes),
    }))
  })
}

interface DdlColumn {
  name: string
  type: string
  notNull: boolean
  defaultExpr: string | null
  identity: string | null
  generated: string | null
  comment: string | null
}

/** 由系统目录拼装一张表的完整建表 DDL(列、约束、独立索引、注释)。 */
async function buildTableDdl(sql: postgres.Sql, schema: string, table: string): Promise<string> {
  const [tableRow] = await sql`
    SELECT c.oid::regclass::text  AS oid_text,
           pg_get_userbyid(c.relowner) AS owner,
           obj_description(c.oid, 'pg_class') AS comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema} AND c.relname = ${table} AND c.relkind IN ('r', 'p')
  `

  if (!tableRow) {
    throw new DbAdminError(`数据表 "${schema}.${table}" 不存在。`)
  }

  const qualified = `${quoteIdent(schema)}.${quoteIdent(table)}`
  const lines: string[] = []

  const columnRows = await sql`
    SELECT a.attname     AS name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull  AS not_null,
           COALESCE(pg_get_expr(ad.adbin, ad.adrelid), NULL) AS default_expr,
           a.attidentity AS identity,
           a.attgenerated AS generated,
           col_description(a.attrelid, a.attnum) AS comment
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = ${tableRow.oid_text}::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
  `

  const columns: DdlColumn[] = columnRows.map((row) => ({
    name: row.name,
    type: row.type,
    notNull: Boolean(row.not_null),
    defaultExpr: typeof row.default_expr === 'string' ? row.default_expr : null,
    identity: typeof row.identity === 'string' ? row.identity : null,
    generated: typeof row.generated === 'string' ? row.generated : null,
    comment: typeof row.comment === 'string' ? row.comment : null,
  }))

  const columnLines = columns.map((column) => {
    let line = `${quoteIdent(column.name)} ${column.type}`

    if (column.generated === 's' && column.defaultExpr) {
      line += ` GENERATED ALWAYS AS (${column.defaultExpr}) STORED`
    } else if (column.identity === 'a') {
      line += ' GENERATED ALWAYS AS IDENTITY'
    } else if (column.identity === 'd') {
      line += ' GENERATED BY DEFAULT AS IDENTITY'
    } else if (column.defaultExpr) {
      line += ` DEFAULT ${column.defaultExpr}`
    }

    if (column.notNull) {
      line += ' NOT NULL'
    }

    return line
  })

  lines.push(`CREATE TABLE ${qualified} (`)
  lines.push(columnLines.map((line) => `    ${line}`).join(',\n'))
  lines.push(');')

  lines.push(`ALTER TABLE ${qualified} OWNER TO ${quoteIdent(String(tableRow.owner))};`)

  const constraintRows = await sql`
    SELECT conname AS name,
           pg_get_constraintdef(oid, true) AS definition
    FROM pg_constraint
    WHERE conrelid = ${tableRow.oid_text}::regclass
      AND contype IN ('p', 'u', 'f', 'c')
    ORDER BY contype, conname
  `

  for (const constraint of constraintRows) {
    lines.push(
      `ALTER TABLE ${qualified} ADD CONSTRAINT ${quoteIdent(constraint.name)} ${constraint.definition};`,
    )
  }

  // pg_indexes 也包含约束背后的索引,排除后再列出独立索引
  const indexRows = await sql`
    SELECT x.indexdef AS definition
    FROM pg_indexes x
    WHERE x.schemaname = ${schema} AND x.tablename = ${table}
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conindid = (
          SELECT cc.oid
          FROM pg_class cc
          JOIN pg_namespace nn ON nn.oid = cc.relnamespace
          WHERE cc.relname = x.indexname AND nn.nspname = x.schemaname
        )
      )
    ORDER BY x.indexname
  `

  for (const row of indexRows) {
    lines.push(`${row.definition};`)
  }

  if (typeof tableRow.comment === 'string' && tableRow.comment !== '') {
    lines.push(`COMMENT ON TABLE ${qualified} IS ${quoteLiteral(tableRow.comment)};`)
  }

  for (const column of columns) {
    if (column.comment) {
      lines.push(
        `COMMENT ON COLUMN ${qualified}.${quoteIdent(column.name)} IS ${quoteLiteral(column.comment)};`,
      )
    }
  }

  return lines.join('\n')
}

/** 单张表的建表 DDL。 */
export async function getTableDdl(
  connectionString: string,
  payload: Record<string, unknown>,
): Promise<{ schema: string; table: string; ddl: string }> {
  const schema = readString(payload, 'schema')
  const table = readString(payload, 'table')

  return withClient(toPostgresJsUrl(connectionString), async (sql) => ({
    schema,
    table,
    ddl: await buildTableDdl(sql, schema, table),
  }))
}

/**
 * 整个数据库的 DDL:建库语句 + 扩展 + 非系统 Schema + 全部数据表,
 * 单连接内顺序生成(表多时避免反复建连)。
 */
export async function getDatabaseDdl(connectionString: string): Promise<{ name: string; ddl: string }> {
  return withClient(toPostgresJsUrl(connectionString), async (sql) => {
    const [database] = await sql`
      SELECT current_database()              AS name,
             pg_get_userbyid(d.datdba)       AS owner,
             pg_encoding_to_char(d.encoding) AS encoding,
             d.datcollate                    AS collate,
             d.datctype                      AS ctype
      FROM pg_database d
      WHERE d.datname = current_database()
    `

    if (!database) {
      throw new DbAdminError('无法读取数据库信息。')
    }

    const extensionRows = await sql`
      SELECT extname AS name FROM pg_extension ORDER BY extname
    `

    const schemaRows = await sql`
      SELECT n.nspname AS name,
             pg_get_userbyid(n.nspowner) AS owner
      FROM pg_namespace n
      WHERE n.nspname NOT IN ('public', 'pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg\\_toast%'
        AND n.nspname NOT LIKE 'pg\\_temp%'
      ORDER BY n.nspname
    `

    const tables = await listTablesInCurrentDatabase(sql)

    const lines: string[] = []

    const localeParts = [
      typeof database.collate === 'string' && database.collate !== '' ? ` LC_COLLATE ${quoteLiteral(database.collate)}` : '',
      typeof database.ctype === 'string' && database.ctype !== '' ? ` LC_CTYPE ${quoteLiteral(database.ctype)}` : '',
    ]
    lines.push(
      `CREATE DATABASE ${quoteIdent(String(database.name))} WITH OWNER ${quoteIdent(String(database.owner))}` +
        ` ENCODING ${quoteLiteral(String(database.encoding))}${localeParts.join('')};`,
    )

    for (const extension of extensionRows) {
      lines.push(`CREATE EXTENSION IF NOT EXISTS ${quoteIdent(String(extension.name))};`)
    }

    for (const schema of schemaRows) {
      lines.push(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(String(schema.name))};`)
      lines.push(`ALTER SCHEMA ${quoteIdent(String(schema.name))} OWNER TO ${quoteIdent(String(schema.owner))};`)
    }

    for (const table of tables) {
      lines.push('')
      lines.push(await buildTableDdl(sql, table.schema, table.table))
    }

    return { name: String(database.name), ddl: lines.join('\n') }
  })
}

/** 与 listTables 同口径的表清单(复用已有连接,供整库 DDL 循环使用)。 */
async function listTablesInCurrentDatabase(sql: postgres.Sql): Promise<Array<{ schema: string; table: string }>> {
  const rows = await sql`
    SELECT n.nspname AS schema,
           c.relname  AS table
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg\\_toast%'
      AND n.nspname NOT LIKE 'pg\\_temp%'
    ORDER BY n.nspname, c.relname
  `

  return rows.map((row) => ({ schema: row.schema, table: row.table }))
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

const API_ACTIONS: Record<
  string,
  (connectionString: string, payload: Record<string, unknown>) => Promise<unknown>
> = {
  overview: (connectionString) => getDatabaseOverview(connectionString),
  tables: (connectionString) => listTables(connectionString),
  'tables/ddl': getTableDdl,
  'database/ddl': (connectionString) => getDatabaseDdl(connectionString),
}

/** 处理 /db-api/<action> 请求;action 未注册时返回 null(由调用方回 404)。 */
export async function handleDbAdminApi(
  action: string,
  payload: unknown,
  connectionString: string,
): Promise<Response | null> {
  const handler = API_ACTIONS[action]

  if (handler === undefined) {
    return null
  }

  try {
    const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
    const result = await handler(connectionString, record)

    return Response.json({ ok: true, data: result })
  } catch (error) {
    if (error instanceof DbAdminError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 })
    }

    // 数据库侧错误把 message 原样透传给界面
    const message = error instanceof Error ? error.message : '数据库查询失败。'
    console.error('[数据库看板]', error)
    return Response.json({ ok: false, error: message }, { status: 400 })
  }
}
