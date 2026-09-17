/** 用户可见的错误(不打印堆栈)。 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'

function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false
  }

  return process.stdout.isTTY === true
}

export function bold(text: string): string {
  return supportsColor() ? `${BOLD}${text}${RESET}` : text
}

export function dim(text: string): string {
  return supportsColor() ? `${DIM}${text}${RESET}` : text
}

export function red(text: string): string {
  return supportsColor() ? `${RED}${text}${RESET}` : text
}

export function yellow(text: string): string {
  return supportsColor() ? `${YELLOW}${text}${RESET}` : text
}
