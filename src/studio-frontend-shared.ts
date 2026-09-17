export const STUDIO_CSS_FILE_NAME = 'studio.css'
export const STUDIO_JS_FILE_NAME = 'studio.js'

export type StudioAdapterType = 'postgres'

export type StudioConfig = {
  adapter: StudioAdapterType
}

export function isStudioAdapterType(value: unknown): value is StudioAdapterType {
  return value === 'postgres'
}
