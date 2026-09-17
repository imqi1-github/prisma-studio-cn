import { spawn } from 'node:child_process'

/** 在系统默认或指定浏览器中打开 Studio(替代 open 依赖)。 */
export function openInBrowser(url: string, browser: string | undefined): void {
  const name = browser || process.env.BROWSER

  if (name?.toLowerCase() === 'none') {
    return
  }

  try {
    switch (process.platform) {
      case 'win32': {
        // `start "" <程序> "地址"` —— 第一个引号参数是窗口标题占位符
        const args = name ? ['/c', 'start', '""', name, url] : ['/c', 'start', '""', url]
        spawn('cmd.exe', args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref()
        break
      }
      case 'darwin': {
        spawn('open', name ? ['-a', name, url] : [url], { detached: true, stdio: 'ignore' }).unref()
        break
      }
      default: {
        spawn(name ?? 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
        break
      }
    }
  } catch {
    // 打开浏览器失败不影响 Studio 本身运行
  }
}
