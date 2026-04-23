/**
 * Storage utility functions using localStorage
 * Compatible with Tauri webview where document.cookie doesn't work
 * Maintains the same API as cookie-based approach for backward compatibility
 */

/**
 * Get a stored value by name
 */
export function getCookie(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return localStorage.getItem(name) ?? undefined
}

/**
 * Set a stored value with name and value
 */
export function setCookie(
  name: string,
  value: string,
  _maxAge?: number
): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(name, value)
}

/**
 * Remove a stored value
 */
export function removeCookie(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(name)
}
