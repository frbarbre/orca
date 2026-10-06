// Runs inside the claude.ai page, so it must stay self-contained: no imports, no outer names.
// Why poll: claude.ai is a single-page app that draws its prompt a moment after the page loads.
function focusClaudePromptInPage(): Promise<boolean> {
  const deadline = Date.now() + 10_000
  return new Promise((resolve) => {
    const tick = (): void => {
      const prompt =
        document.querySelector('[data-testid="code-prompt-input"]') ??
        document.querySelector('[role="textbox"][aria-label="Prompt"]')
      if (prompt instanceof HTMLElement) {
        prompt.focus()
        const selection = window.getSelection()
        if (selection) {
          const caret = document.createRange()
          caret.selectNodeContents(prompt)
          caret.collapse(false)
          selection.removeAllRanges()
          selection.addRange(caret)
        }
        resolve(true)
        return
      }
      if (Date.now() > deadline) {
        resolve(false)
        return
      }
      setTimeout(tick, 100)
    }
    tick()
  })
}

export const FOCUS_CLAUDE_PROMPT_SCRIPT = `(${focusClaudePromptInPage.toString()})()`
