import { clipboard, Menu, shell } from 'electron'

export type ClaudeWebMenuActions = {
  cut: () => void
  copy: () => void
  paste: () => void
  selectAll: () => void
  openLink: (url: string) => void
  copyText: (text: string) => void
}

export type ClaudeWebMenuItem = { label: string; enabled: boolean; click: () => void }

export function buildClaudeWebContextMenu(
  params: Electron.ContextMenuParams,
  actions: ClaudeWebMenuActions
): ClaudeWebMenuItem[] {
  const items: ClaudeWebMenuItem[] = []
  const link = params.linkURL
  // Why only http(s): Open Link hands the URL to the OS, and a page must not choose another scheme.
  if (link && /^https?:\/\//i.test(link)) {
    items.push(
      { label: 'Open Link', enabled: true, click: () => actions.openLink(link) },
      { label: 'Copy Link', enabled: true, click: () => actions.copyText(link) }
    )
  }
  const flags = params.editFlags
  if (params.isEditable) {
    items.push(
      { label: 'Cut', enabled: flags.canCut, click: actions.cut },
      { label: 'Copy', enabled: flags.canCopy, click: actions.copy },
      { label: 'Paste', enabled: flags.canPaste, click: actions.paste }
    )
  } else if (params.selectionText) {
    items.push({ label: 'Copy', enabled: flags.canCopy, click: actions.copy })
  }
  items.push({ label: 'Select All', enabled: flags.canSelectAll, click: actions.selectAll })
  return items
}

const installedGuests = new WeakSet<object>()

// Fork: a <webview> shows no menu of its own on right-click, so the claude.ai page got none.
export function installClaudeWebContextMenu(guest: Electron.WebContents): void {
  if (installedGuests.has(guest)) {
    return
  }
  installedGuests.add(guest)
  guest.on('context-menu', (_event, params) => {
    const items = buildClaudeWebContextMenu(params, {
      cut: () => guest.cut(),
      copy: () => guest.copy(),
      paste: () => guest.paste(),
      selectAll: () => guest.selectAll(),
      openLink: (url) => void shell.openExternal(url),
      copyText: (text) => clipboard.writeText(text)
    })
    const separatorAfterLink = items[0]?.label === 'Open Link' ? 2 : -1
    Menu.buildFromTemplate(
      items.flatMap((item, index) => [
        ...(index === separatorAfterLink ? [{ type: 'separator' as const }] : []),
        { label: item.label, enabled: item.enabled, click: item.click }
      ])
    ).popup()
  })
}
