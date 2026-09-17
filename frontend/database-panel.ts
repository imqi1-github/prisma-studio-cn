import { DATABASE_VIEW, isDatabaseViewHash } from './database-view.js'

/**
 * Studio 侧边栏「数据库」页签:
 *
 * - 在原生导航(nav[aria-label="Studio"],哈希路由由 studio-core 的 nuqs
 *   驱动)末尾注入一个同样式的链接,指向 #schema=…&view=database;
 * - view=database 是 studio-core 未定义的视图值:原生三项全部进入未激活
 *   状态,主区域保持原样,这里再覆盖一层 iframe 指向服务端渲染的看板页
 *   (/db-dashboard),样式与 Studio 互不干扰;
 * - React 重渲染随时可能移除注入的链接,用 MutationObserver 检测并补回。
 */

const NAV_SELECTOR = 'nav[aria-label="Studio"]'
const PANEL_ID = 'studio-database-panel'
const PANEL_IFRAME_ID = 'studio-database-panel-frame'
const NAV_LINK_ID = 'studio-database-nav-link'

// Studio 对未知视图渲染的兜底文案:运行时翻译后是中文,翻译前是英文,
// 两种形态都要识别(它在真实视图挂载前会短暂存在于 DOM)
const FALLBACK_VIEW_TEXT = {
  zh: '视图加载有误',
  en: 'incorrectly loaded',
} as const

// 延迟隐藏的上限:兜底文本迟迟不消失时也必须把界面还给用户
const PANEL_HIDE_DEADLINE_MS = 600

export function installDatabasePanel(): void {
  // 延迟隐藏的代际标记:重新激活面板时递增,取消尚在轮询的隐藏任务
  let hideToken = 0

  // React 渲染是异步的,导航要在挂载完成后才出现
  const observer = new MutationObserver(ensureInstalled)

  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })

  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('resize', updatePanelGeometry)

  // 刷新 / 书签直达时 URL 带着 view=database:studio-core 的路由初始化会把
  // 未知视图改写回默认视图,这里在首次改写时恢复一次,之后的导航不再干预
  let pendingRestore: string | null = isDatabaseViewHash(window.location.hash) ? window.location.hash : null

  if (pendingRestore !== null) {
    setTimeout(() => {
      pendingRestore = null
    }, 8000)
  }

  function onHashChange(): void {
    if (pendingRestore !== null && !isDatabaseViewHash(window.location.hash)) {
      const target = pendingRestore

      pendingRestore = null
      setTimeout(() => {
        window.location.hash = target
        syncState()
      }, 50)

      return
    }

    pendingRestore = null
    syncState()
  }

  function ensureInstalled(): void {
    const nav = document.querySelector(NAV_SELECTOR)

    if (nav === null) {
      return
    }

    if (document.getElementById(PANEL_ID) === null) {
      installPanel()
    }

    if (document.getElementById(NAV_LINK_ID) === null) {
      installNavLink(nav)
      syncState()
    }
  }

  function installNavLink(nav: Element): void {
    // 克隆原生链接以继承全部样式类,再替换目标与文本
    const template = nav.querySelector('a[href*="view="]')

    if (template === null) {
      return
    }

    const link = template.cloneNode(true) as HTMLAnchorElement

    link.id = NAV_LINK_ID
    link.href = link.href.replace(/view=[^&]*/, `view=${DATABASE_VIEW}`)
    link.removeAttribute('data-active')
    link.textContent = '数据库'
    link.addEventListener('click', () => {
      // 与原生链接一致:交由哈希路由驱动,这里只是兜底确保状态立即同步
      queueMicrotask(syncState)
    })

    nav.appendChild(link)
  }

  function installPanel(): void {
    const panel = document.createElement('div')

    panel.id = PANEL_ID
    panel.style.cssText = 'position:fixed;display:none;z-index:30;background:var(--background);'
    panel.innerHTML = `<iframe id="${PANEL_IFRAME_ID}" title="数据库看板" style="width:100%;height:100%;border:none;display:block;"></iframe>`

    // 挂进 Studio 的根容器,主题变量(--background 等)才作用于面板;
    // 找不到时退回 body(看板 iframe 自带背景,仍然可用)
    const studioRoot = document.querySelector('.ps')

    if (studioRoot !== null) {
      studioRoot.appendChild(panel)
    } else {
      document.body.appendChild(panel)
    }
  }

  function syncState(): void {
    const active = isDatabaseViewHash(window.location.hash)
    const link = document.getElementById(NAV_LINK_ID)
    const panel = document.getElementById(PANEL_ID)

    if (link !== null) {
      if (active) {
        link.setAttribute('data-active', 'true')
      } else {
        link.removeAttribute('data-active')
      }
    }

    if (panel === null) {
      return
    }

    if (active) {
      hideToken += 1
      updatePanelGeometry()
      panel.style.display = 'block'

      // 惰性加载:首次进入「数据库」页签才发起看板页请求
      const frame = document.getElementById(PANEL_IFRAME_ID) as HTMLIFrameElement | null

      if (frame !== null && frame.getAttribute('src') === null) {
        frame.src = '/db-dashboard'
      }
    } else {
      schedulePanelHide()
    }
  }

  /**
   * 离开「数据库」页签时不立刻收起面板:Studio 还要一两个渲染周期才把
   * 兜底视图(「视图加载有误」)换成目标视图,立刻收起会闪出兜底文案。
   * 这里逐帧等兜底文本从 DOM 消失后再隐藏,超过上限则无条件隐藏。
   */
  function schedulePanelHide(): void {
    const token = ++hideToken
    const startedAt = performance.now()

    const step = (): void => {
      if (token !== hideToken) {
        return // 期间又切回了「数据库」页签,交给激活逻辑处理
      }

      const panel = document.getElementById(PANEL_ID)

      if (panel === null) {
        return
      }

      const bodyText = document.body.textContent ?? ''
      const fallbackGone = !bodyText.includes(FALLBACK_VIEW_TEXT.zh) && !bodyText.includes(FALLBACK_VIEW_TEXT.en)
      const timedOut = performance.now() - startedAt > PANEL_HIDE_DEADLINE_MS

      if (fallbackGone || timedOut) {
        panel.style.display = 'none'
        return
      }

      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }

  /** 覆盖层从侧边栏右缘铺到视口右下;侧边栏折叠 / 展开时靠 resize 事件重新测量。 */
  function updatePanelGeometry(): void {
    const panel = document.getElementById(PANEL_ID)

    if (panel === null) {
      return
    }

    const nav = document.querySelector(NAV_SELECTOR)
    const sidebar = nav !== null ? findSidebarRoot(nav) : null

    if (sidebar === null) {
      panel.style.left = '0'
      panel.style.top = '0'
      panel.style.right = '0'
      panel.style.bottom = '0'
      return
    }

    const rect = sidebar.getBoundingClientRect()

    panel.style.left = `${rect.right}px`
    panel.style.top = `${rect.top}px`
    panel.style.right = '0'
    panel.style.bottom = '0'
  }

  function findSidebarRoot(nav: Element): Element | null {
    let current: Element | null = nav

    // 侧边栏容器是纵向 flex、限宽(shrink-0),且高度铺满应用区
    while (current !== null) {
      const className = typeof current.className === 'string' ? current.className : ''

      if (className.includes('shrink-0') && className.includes('flex-col')) {
        return current
      }

      current = current.parentElement
    }

    return null
  }

  ensureInstalled()
}
