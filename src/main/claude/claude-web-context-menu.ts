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

export type ClaudeWebMenuHost = {
  showMenu: (items: readonly ClaudeWebMenuItem[], separatorBefore: number) => void
  openExternal: (url: string) => void
  writeClipboard: (text: string) => void
}

// Fork: a <webview> shows no menu of its own on right-click, so the claude.ai page got none.
// Why the host is passed in: this module is reachable from the headless runtime, which has no Electron.
export function installClaudeWebContextMenu(
  guest: Electron.WebContents,
  host: ClaudeWebMenuHost
): void {
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
      openLink: host.openExternal,
      copyText: host.writeClipboard
    })
    host.showMenu(items, items[0]?.label === 'Open Link' ? 2 : -1)
  })
}
