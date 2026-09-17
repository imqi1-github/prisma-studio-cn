/**
 * lodash `debounce` 的本地精简实现(供 @visx/responsive 使用),
 * 支持 leading / trailing 选项与 cancel / flush 方法,覆盖 visx 的用法。
 */
export default function debounce(func, waitMilliseconds = 0, options = {}) {
  let timeoutId
  let pendingArgs
  let pendingThis

  const leading = options.leading === true
  const trailing = options.trailing !== false

  function invoke() {
    timeoutId = undefined
    const args = pendingArgs
    const context = pendingThis
    pendingArgs = undefined
    pendingThis = undefined

    if (trailing && args !== undefined) {
      func.apply(context, args)
    }
  }

  function debounced(...args) {
    pendingArgs = args
    pendingThis = this

    const isCold = timeoutId === undefined
    const shouldCallLeading = leading && isCold

    if (isCold) {
      timeoutId = setTimeout(invoke, waitMilliseconds)
    }

    if (shouldCallLeading) {
      pendingArgs = undefined
      pendingThis = undefined
      return func.apply(this, args)
    }

    return undefined
  }

  debounced.cancel = function cancel() {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }

    pendingArgs = undefined
    pendingThis = undefined
  }

  debounced.flush = function flush() {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      invoke()
    }
  }

  return debounced
}
