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
}
