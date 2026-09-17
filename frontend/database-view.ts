/**
 * 「数据库」页签在 Studio 哈希路由中的视图名与判定。
 *
 * studio-core 用 nuqs 管理形如 #schema=public&view=console 的哈希状态,
 * 未定义的视图值不会命中任何原生视图,原生导航全部进入未激活状态 ——
 * 这正是本页签借用的现成路由机制。
 */

export const DATABASE_VIEW = 'database'

export function isDatabaseViewHash(hash: string): boolean {
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (part === `view=${DATABASE_VIEW}`) {
      return true
    }
  }

  return false
}
