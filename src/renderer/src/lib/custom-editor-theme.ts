import { monaco } from './monaco-setup'

export const CUSTOM_DARK_THEME = 'orca-custom-dark'
export const CUSTOM_LIGHT_THEME = 'orca-custom-light'

let registration: Promise<{ dark: boolean; light: boolean }> | null = null
let registered = { dark: false, light: false }

/**
 * Registers the user's VS Code themes with Monaco, once per session.
 *
 * Why a module-level promise rather than a hook: every editor and diff viewer needs the same two
 * themes, `defineTheme` is global to Monaco, and registering per mount would redefine them on every
 * tab switch. Callers await the same registration.
 */
export function ensureCustomEditorThemes(): Promise<{ dark: boolean; light: boolean }> {
  registration ??= (async () => {
    try {
      const themes = await window.api.app.getCustomEditorThemes()
      if (themes.dark) {
        monaco.editor.defineTheme(CUSTOM_DARK_THEME, themes.dark)
      }
      if (themes.light) {
        monaco.editor.defineTheme(CUSTOM_LIGHT_THEME, themes.light)
      }
      registered = { dark: Boolean(themes.dark), light: Boolean(themes.light) }
    } catch (error) {
      // Why swallow: a bad theme must cost the user their colours, not their editor.
      console.warn('[editor-theme] could not register custom themes:', error)
      registered = { dark: false, light: false }
    }
    return registered
  })()
  return registration
}

/** The theme name to hand Monaco: the user's if they supplied one for this mode, else the stock one. */
export function editorThemeName(isDark: boolean): string {
  if (isDark) {
    return registered.dark ? CUSTOM_DARK_THEME : 'vs-dark'
  }
  return registered.light ? CUSTOM_LIGHT_THEME : 'vs'
}
