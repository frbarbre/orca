export type ClaudeRemoteSessionUrlResult =
  | { status: 'ready'; url: string }
  | { status: 'remote-control-off'; startedAt: number }
  | { status: 'session-not-found' }

export type ClaudeWebReplayedKey = {
  type: 'keydown' | 'keyup'
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  /** Fork: the page kept this key; Orca only watches it for its held-modifier hints. */
  observed?: true
  /** Fork: the key is one of the terminal split shortcuts, resolved with the user's rebinds. */
  split?: 'right' | 'down'
}
