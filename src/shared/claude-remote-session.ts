export type ClaudeRemoteSessionUrlResult =
  | { status: 'ready'; url: string }
  | { status: 'remote-control-off' }
  | { status: 'session-not-found' }
