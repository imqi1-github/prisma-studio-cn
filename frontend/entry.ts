import { createStudioBFFClient } from '@prisma/studio-core/data/bff'
import { createPostgresAdapter } from '@prisma/studio-core/data/postgres-core'
import { Studio, type StudioProps } from '@prisma/studio-core/ui'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

import { installChineseLocalization } from './i18n/index.js'
import { installDatabasePanel } from './database-panel.js'
import { isStudioAdapterType, type StudioConfig } from '../src/studio-frontend-shared.js'

function getStudioConfig(): StudioConfig {
  const config = (window as Window & { __STUDIO_CONFIG__?: Partial<StudioConfig> }).__STUDIO_CONFIG__

  if (config && isStudioAdapterType(config.adapter)) {
    return { adapter: config.adapter }
  }

  throw new Error('Prisma Studio 前端配置无效。')
}

function getRootElement(): HTMLElement {
  const rootElement = document.getElementById('root')

  if (rootElement instanceof HTMLElement) {
    return rootElement
  }

  throw new Error('未找到 Prisma Studio 根元素。')
}

// 先安装汉化,再渲染,尽量避免英文闪现
installChineseLocalization()

const adapter = createPostgresAdapter({
  executor: createStudioBFFClient({ url: '/bff' }),
})

const onEvent = (event: Parameters<NonNullable<StudioProps['onEvent']>>[0]) => {
  // 中文版已移除遥测,保留空实现以维持组件接口兼容
  void fetch('/telemetry', {
    body: JSON.stringify(event),
    method: 'POST',
  }).catch(() => {
    // noop
  })
}

;(window as Window & { __PVCE__?: boolean }).__PVCE__ = true

createRoot(getRootElement()).render(createElement(Studio, { adapter, onEvent }))

// 挂在页面右缘的「退出登录」入口:注销会话并回到登录页。
// 配色跟随系统深浅色(与登录页同源的 studio.css 主题色),不做手动切换。
installLogoutButton()

// 侧边栏「数据库」页签:注入导航链接 + iframe 看板(只读,查看库定义与表 DDL)。
installDatabasePanel()

function installLogoutButton(): void {
  const style = document.createElement('style')

  style.textContent = `
.studio-logout-btn {
  --btn-fg: oklch(0.985 0 0);
  --btn-bg: oklch(0.21 0.006 285.885 / 92%);
  --btn-border: oklch(1 0 0 / 16%);
  --btn-fg-hover: oklch(0.985 0 0);
  --btn-bg-hover: oklch(0.274 0.006 286.033 / 95%);
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 2147483647;
  padding: 8px 10px;
  font: 12px/1 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
  color: var(--btn-fg);
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
}
.studio-logout-btn:hover {
  color: var(--btn-fg-hover);
  background: var(--btn-bg-hover);
}
@media (prefers-color-scheme: light) {
  .studio-logout-btn {
    --btn-fg: oklch(0.552 0.016 285.938);
    --btn-bg: oklch(1 0 0 / 92%);
    --btn-border: oklch(0.92 0.004 286.32);
    --btn-fg-hover: oklch(0.141 0.005 285.823);
    --btn-bg-hover: oklch(0.967 0.001 286.375 / 95%);
  }
}`

  const button = document.createElement('button')

  button.type = 'button'
  button.className = 'studio-logout-btn'
  button.textContent = '退出登录'
  button.setAttribute('aria-label', '退出登录')
  button.addEventListener('click', () => {
    void fetch('/logout', { method: 'POST' })
      .catch(() => undefined)
      .then(() => {
        window.location.reload()
      })
  })

  document.head.appendChild(style)
  document.body.appendChild(button)
}
