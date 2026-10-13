export type WorkspaceCommandRequest = {
  worktreePath: string
  command: string
}

export type WorkspaceCommandResult = {
  success: boolean
  /** The tail of what the command printed. */
  output: string
}
