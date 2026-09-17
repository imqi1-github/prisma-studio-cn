export type Runtime = 'node' | 'bun' | 'deno' | 'unknown'

/** 检测当前 JavaScript 运行时(替代 std-env 依赖)。 */
export function getRuntime(): Runtime {
  const globalThisRef = globalThis as typeof globalThis & {
    Bun?: unknown
    Deno?: unknown
  }

  if (globalThisRef.Bun !== undefined) {
    return 'bun'
  }

  if (globalThisRef.Deno !== undefined) {
    return 'deno'
  }

  if (typeof process !== 'undefined' && process.versions?.node !== undefined) {
    return 'node'
  }

  return 'unknown'
}
