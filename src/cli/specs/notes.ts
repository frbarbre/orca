import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const NOTES_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['notes', 'add'],
    summary: 'Leave an agent note on lines of a changed file, shown as a bot note in the diff',
    usage:
      'orca notes add --file <path> --line <n> [--end-line <n>] --body <text> [--agent <name>] [--github-comment <url>] [--worktree <selector>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'file',
      'line',
      'end-line',
      'body',
      'agent',
      'github-comment',
      'worktree'
    ],
    notes: [
      'Use it to tell the user what you reviewed or how you resolved one of their notes, on the lines you changed. It is shown apart from the user notes and is never sent back to an agent.',
      'Line numbers are in the current version of the file. --file may be relative to cwd or absolute inside the worktree. --agent names you (for example "Claude Code" or "Codex"); it defaults to Claude Code inside Claude Code, else "Agent".',
      'When the note answers a GitHub review comment, pass its link with --github-comment so the note links back to it.'
    ],
    examples: [
      'orca notes add --file src/api.ts --line 42 --body "Renamed fetchUser and updated both callers."',
      'orca notes add --file src/api.ts --line 40 --end-line 58 --agent Codex --body "Review: this retry loop never backs off."'
    ]
  },
  {
    path: ['notes', 'reply'],
    summary: "Reply to one of the user's diff notes; the reply shows under their note",
    usage:
      'orca notes reply --id <note-id> --body <text> [--agent <name>] [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'body', 'agent', 'worktree'],
    notes: [
      'Use it when the user sent you their notes: say on each one what you did. The note id is in the prompt ("Note id: …") and in orca notes list.'
    ],
    examples: [
      'orca notes reply --id 3f2a… --body "Renamed to fetchUser and updated both callers."'
    ]
  },
  {
    path: ['notes', 'list'],
    summary: "List the user's notes and the agent notes in a worktree",
    usage: 'orca notes list [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree'],
    examples: ['orca notes list', 'orca notes list --json']
  },
  {
    path: ['notes', 'rm'],
    summary: 'Remove an agent note',
    usage: 'orca notes rm --id <note-id> [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'worktree'],
    examples: ['orca notes rm --id 3f2a…']
  }
]
