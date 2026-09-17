/**
 * Studio 侧边栏「数据库」页签的内嵌看板页面(服务端渲染的单文件 HTML,
 * 由前端通过 iframe 挂载,与登录页同一套做法):
 *
 * - 配色取自 studio.css 的主题变量,通过 prefers-color-scheme 跟随系统深浅色;
 * - 原生 JavaScript,无构建步骤;所有数据经 POST /db-api/<action> 只读获取;
 * - 上半部分是数据库概览(基本信息、Schema、扩展),下半部分是数据表列表
 *   与 DDL 面板(单个数据表或整个数据库,由系统目录生成)。
 */
// prettier-ignore
export function getDatabaseDashboardHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>数据库看板 · Prisma Studio(中文版)</title>
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
        --muted: oklch(0.967 0.001 286.375);
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
          --muted: oklch(0.274 0.006 286.033);
          --primary-foreground: oklch(0.21 0.006 285.885);
          --destructive: oklch(0.704 0.191 22.216);
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px 18px 32px;
        background: var(--background);
        color: var(--foreground);
        font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', Roboto, sans-serif;
        font-size: 13px;
      }
      h2 { margin: 0 0 10px; font-size: 14px; }
      section { margin-bottom: 22px; }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 8px;
      }
      .card {
        padding: 10px 12px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }
      .card .k { color: var(--muted-foreground); font-size: 12px; margin-bottom: 3px; }
      .card .v { font-size: 13px; font-weight: 600; word-break: break-all; }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .chip {
        padding: 3px 10px;
        background: color-mix(in oklab, var(--primary) 10%, transparent);
        color: var(--primary);
        border-radius: 999px;
        font-size: 12px;
      }
      .chip small { color: inherit; opacity: 0.75; }
      .layout { display: grid; grid-template-columns: minmax(300px, 420px) 1fr; gap: 14px; align-items: start; }
      .layout > div { min-width: 0; }
      @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
      table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
      th, td { padding: 7px 10px; text-align: left; border-bottom: 1px solid var(--border); font-size: 12px; white-space: nowrap; }
      th { background: var(--muted); color: var(--muted-foreground); font-weight: 600; }
      tbody tr:last-child td { border-bottom: none; }
      .table-list { max-height: 52vh; overflow: auto; }
      .table-list tbody tr { cursor: pointer; }
      .table-list tbody tr:hover { background: color-mix(in oklab, var(--primary) 5%, transparent); }
      .table-list tbody tr.selected { background: color-mix(in oklab, var(--primary) 12%, transparent); }
      td.dim { color: var(--muted-foreground); }
      button {
        padding: 6px 12px;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: var(--radius);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover { background: color-mix(in oklab, var(--primary) 88%, transparent); }
      button:disabled { opacity: 0.5; cursor: default; }
      button.secondary {
        background: transparent;
        color: var(--foreground);
        border: 1px solid var(--input);
        font-weight: 400;
      }
      .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .toolbar .spacer { flex: 1; }
      .toolbar .target { color: var(--muted-foreground); }
      pre.ddl {
        margin: 0;
        padding: 12px;
        background: var(--muted);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font-family: Consolas, 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.6;
        overflow: auto;
        max-height: 52vh;
        white-space: pre;
      }
      .empty { padding: 20px; text-align: center; color: var(--muted-foreground); }
      #error {
        display: none;
        margin: 0 0 14px;
        padding: 8px 12px;
        background: color-mix(in oklab, var(--destructive) 10%, transparent);
        border: 1px solid color-mix(in oklab, var(--destructive) 45%, transparent);
        border-radius: var(--radius);
        color: var(--destructive);
        font-size: 12px;
      }
      #error.visible { display: block; }
    </style>
  </head>
  <body>
    <p id="error" role="alert"></p>

    <section>
      <h2>数据库概览</h2>
      <div class="cards" id="overview-cards">
        <div class="empty" style="grid-column:1/-1;">正在加载…</div>
      </div>
      <div style="margin-top:10px;" class="chips" id="schema-chips"></div>
      <div style="margin-top:8px;" class="chips" id="extension-chips"></div>
    </section>

    <section>
      <h2>数据表</h2>
      <div class="layout">
        <div>
          <div class="table-list">
            <table>
              <thead><tr><th>数据表</th><th>列</th><th>索引</th><th>大小</th></tr></thead>
              <tbody id="table-rows"><tr><td colspan="4" class="empty">正在加载…</td></tr></tbody>
            </table>
          </div>
        </div>
        <div>
          <div class="toolbar">
            <span class="target" id="ddl-target">在左侧选择一张数据表</span>
            <div class="spacer"></div>
            <button id="db-ddl" class="secondary">数据库 DDL</button>
            <button id="ddl-copy" class="secondary" disabled>复制 DDL</button>
          </div>
          <pre class="ddl" id="ddl-output">// 在左侧选择一张数据表,这里会显示从系统目录生成的完整建表 DDL。</pre>
        </div>
      </div>
    </section>

    <script>
      function esc(value) {
        return String(value).replace(/[&<>"']/g, function (ch) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        })
      }

      var errorBox = document.getElementById('error')
      function showError(message) {
        errorBox.textContent = message
        errorBox.classList.add('visible')
      }
      function clearError() { errorBox.classList.remove('visible') }

      function api(action, payload) {
        return fetch('/db-api/' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        }).then(function (response) {
          // 会话过期时父页面同样需要重新登录
          if (response.status === 401) {
            window.top.location.reload()
            return new Promise(function () {})
          }
          return response.json().catch(function () {
            throw new Error('服务端响应解析失败。')
          }).then(function (body) {
            if (!response.ok || body.ok === false) {
              throw new Error(body.error || '查询失败,请稍后重试。')
            }
            return body.data
          })
        })
      }

      function qualifiedName(schema, table) {
        return schema === 'public' ? table : schema + '.' + table
      }

      // —— 概览 ——

      function renderOverview(data) {
        var cards = [
          { k: '数据库', v: data.name },
          { k: '所有者', v: data.owner },
          { k: '编码', v: data.encoding },
          { k: '排序规则', v: data.collate + ' / ' + data.ctype },
          { k: '大小', v: data.size },
          { k: '连接数', v: data.connections + (data.connectionLimit === -1 ? '(不限)' : '/' + data.connectionLimit) },
        ]

        // 服务端版本只取「PostgreSQL 16.3」这段短描述
        var versionMatch = /((?:PostgreSQL|pgedge|EnterpriseDB) [^\s(]+)/.exec(data.version)
        cards.push({ k: '版本', v: versionMatch ? versionMatch[1] : data.version.split(' ').slice(0, 2).join(' ') })

        document.getElementById('overview-cards').innerHTML = cards.map(function (card) {
          return '<div class="card"><div class="k">' + esc(card.k) + '</div><div class="v">' + esc(card.v) + '</div></div>'
        }).join('')

        document.getElementById('schema-chips').innerHTML = data.schemas.map(function (schema) {
          return '<span class="chip">' + esc(schema.name) + ' <small>' + schema.tables + ' 表</small></span>'
        }).join('') || '<span class="chip">无用户 Schema</span>'

        document.getElementById('extension-chips').innerHTML = data.extensions.map(function (extension) {
          return '<span class="chip">' + esc(extension.name) + ' <small>' + esc(extension.version) + '</small></span>'
        }).join('')
      }

      // —— 数据表与 DDL ——

      // 过期响应守卫:每次发起生成递增,响应回来时对不上号就丢弃
      var ddlToken = 0

      function clearTableSelection() {
        var tbody = document.getElementById('table-rows')
        for (var row of tbody.querySelectorAll('tr.selected')) row.classList.remove('selected')
      }

      function renderTables(tables) {
        var tbody = document.getElementById('table-rows')

        if (tables.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty">没有数据表。</td></tr>'
          return
        }

        tbody.innerHTML = tables.map(function (table) {
          return '<tr data-schema="' + esc(table.schema) + '" data-table="' + esc(table.table) + '">' +
            '<td><strong>' + esc(qualifiedName(table.schema, table.table)) + '</strong>' +
            (table.comment ? '<div class="dim">' + esc(table.comment) + '</div>' : '') + '</td>' +
            '<td>' + table.columns + '</td><td>' + table.indexes + '</td>' +
            '<td class="dim">' + esc(table.size) + '</td></tr>'
        }).join('')

        for (var row of tbody.querySelectorAll('tr[data-table]')) {
          row.addEventListener('click', function () {
            clearTableSelection()
            this.classList.add('selected')
            loadDdl(this.dataset.schema, this.dataset.table)
          })
        }
      }

      function loadDdl(schema, table) {
        var token = ++ddlToken
        document.getElementById('ddl-target').textContent = qualifiedName(schema, table)
        document.getElementById('ddl-output').textContent = '// 正在生成 DDL…'
        document.getElementById('ddl-copy').disabled = true
        api('tables/ddl', { schema: schema, table: table }).then(function (result) {
          if (token !== ddlToken) return
          document.getElementById('ddl-output').textContent = result.ddl
          document.getElementById('ddl-copy').disabled = false
          clearError()
        }).catch(function (error) {
          if (token !== ddlToken) return
          document.getElementById('ddl-output').textContent = '// 生成失败:' + (error && error.message ? error.message : '未知错误')
        })
      }

      // 整个数据库的 DDL(建库 + 扩展 + Schema + 全部数据表)
      function loadDatabaseDdl() {
        var token = ++ddlToken
        clearTableSelection()
        document.getElementById('ddl-target').textContent = '数据库 DDL'
        document.getElementById('ddl-output').textContent = '// 正在生成整个数据库的 DDL,数据表多时需要几秒钟…'
        document.getElementById('ddl-copy').disabled = true
        var button = document.getElementById('db-ddl')
        button.disabled = true
        api('database/ddl', {}).then(function (result) {
          if (token !== ddlToken) return
          document.getElementById('ddl-output').textContent = result.ddl
          document.getElementById('ddl-copy').disabled = false
          clearError()
        }).catch(function (error) {
          if (token !== ddlToken) return
          document.getElementById('ddl-output').textContent = '// 生成失败:' + (error && error.message ? error.message : '未知错误')
        }).finally(function () {
          button.disabled = false
        })
      }

      document.getElementById('db-ddl').addEventListener('click', loadDatabaseDdl)

      document.getElementById('ddl-copy').addEventListener('click', function () {
        navigator.clipboard.writeText(document.getElementById('ddl-output').textContent).then(function () {
          var button = document.getElementById('ddl-copy')
          button.textContent = '已复制'
          setTimeout(function () { button.textContent = '复制 DDL' }, 1500)
        })
      })

      // —— 初始加载 ——

      Promise.all([api('overview'), api('tables')]).then(function (results) {
        clearError()
        renderOverview(results[0])
        renderTables(results[1])
      }).catch(function (error) {
        showError(error && error.message ? error.message : '加载数据库信息失败。')
        document.getElementById('overview-cards').innerHTML = ''
        document.getElementById('table-rows').innerHTML = '<tr><td colspan="4" class="empty">加载失败</td></tr>'
      })
    </script>
  </body>
</html>`
}
