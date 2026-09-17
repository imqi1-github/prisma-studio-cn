import { PATTERNS, SKIP_SELECTOR, TRANSLATIONS } from './dictionary.js'

/**
 * 运行时 DOM 兜底翻译:
 *
 * 构建期已经把打包产物里的完整字符串字面量替换为中文,运行时层负责两类残留:
 * 1. 动态拼接出来的文本(如 "3 rows"、"Page 1 of 5");
 * 2. React 重渲染后恢复的英文文本。
 *
 * 为避免误伤用户数据,文本节点的完整内容必须精确命中字典(或正则规则)才会被替换,
 * 并且跳过可编辑区域。中文译文不会命中任何英文键,因此天然幂等,不会造成死循环。
 */

interface TranslationRule {
  match(text: string): string | null
}

const exactRules: TranslationRule[] = Object.entries(TRANSLATIONS).map(([en, zh]) => ({
  match(text: string) {
    return text === en ? zh : null
  },
}))

const patternRules: TranslationRule[] = PATTERNS.map(([pattern, replacement]) => ({
  match(text: string) {
    if (!pattern.test(text)) {
      return null
    }

    // 注意:同一实例上的带 g 标志的正则存在 lastIndex 状态,这里每次重建
    return text.replace(new RegExp(pattern.source, pattern.flags), replacement)
  },
}))

const rules: TranslationRule[] = [...exactRules, ...patternRules]

function translateText(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed === '') {
    return null
  }

  for (const rule of rules) {
    const translated = rule.match(trimmed)

    if (translated !== null) {
      // 保留原文本前后的空白与换行,避免影响布局
      return value.replace(trimmed, translated)
    }
  }

  return null
}

function shouldSkip(element: Element | null): boolean {
  return element?.closest(SKIP_SELECTOR) !== null
}

function translateTextNode(node: Text): void {
  const parent = node.parentElement

  if (parent !== null && shouldSkip(parent)) {
    return
  }

  const value = node.nodeValue

  if (value === null) {
    return
  }

  const translated = translateText(value)

  if (translated !== null) {
    node.nodeValue = translated
  }
}

function translateElementAttributes(element: Element): void {
  for (const attribute of ['placeholder', 'title', 'aria-label'] as const) {
    const value = element.getAttribute(attribute)

    if (value === null) {
      continue
    }

    const translated = translateText(value)

    if (translated !== null) {
      element.setAttribute(attribute, translated)
    }
  }
}

function translateTree(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)

  // TreeWalker 会把遍历过程中新替换的节点也纳入,这里先收集再处理
  const textNodes: Text[] = []
  const elements: Element[] = []

  let current = walker.nextNode()

  while (current !== null) {
    if (current instanceof Text) {
      textNodes.push(current)
    } else if (current instanceof Element) {
      elements.push(current)
    }

    current = walker.nextNode()
  }

  for (const textNode of textNodes) {
    translateTextNode(textNode)
  }

  for (const element of elements) {
    translateElementAttributes(element)
  }
}

export function installChineseLocalization(): void {
  document.documentElement.lang = 'zh-CN'

  let scheduled = false

  const process = () => {
    scheduled = false

    if (document.body !== null) {
      translateTree(document.body)
    }
  }

  const schedule = () => {
    if (scheduled) {
      return
    }

    scheduled = true
    requestAnimationFrame(process)
  }

  if (document.body !== null) {
    process()
  }

  const observer = new MutationObserver((mutations) => {
    // 只在有新增节点或文本/属性变化时全量处理一次(rAF 去重,开销可控)
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData' || mutation.type === 'attributes') {
        schedule()
        return
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label'],
  })
}
