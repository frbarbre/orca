import path from 'node:path'
import type { DiffComment } from '../../shared/diff-comment-types'
import type { RuntimeWorktreeRecord } from '../../shared/runtime-types'
import { isRuntimePathAbsolute, relativePathInsideRoot } from '../../shared/cross-platform-path'
import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { getOptionalWorktreeSelector, resolveCurrentWorktreeSelector } from '../selectors'

type NoteListResult = { userNotes: DiffComment[]; agentNotes: DiffComment[] }

async function getNotesWorktreeSelector({ flags, cwd, client }: HandlerContext): Promise<string> {
  const explicit = await getOptionalWorktreeSelector(flags, 'worktree', cwd, client)
  if (explicit) {
    return explicit
  }
  if (client.isRemote) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Remote notes commands require --worktree because the client cwd cannot identify a server worktree.'
    )
  }
  return await resolveCurrentWorktreeSelector(cwd, client)
}

async function resolveNoteFilePath(
  ctx: HandlerContext,
  worktree: string,
  file: string
): Promise<string> {
  const { result } = await ctx.client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
    worktree
  })
  const rootPath = result.worktree.path
  const fromCwd = isRuntimePathAbsolute(file) ? file : path.resolve(ctx.cwd, file)
  const relative =
    relativePathInsideRoot(rootPath, fromCwd) ??
    (isRuntimePathAbsolute(file)
      ? null
      : relativePathInsideRoot(rootPath, path.join(rootPath, file)))
  if (!relative) {
    throw new RuntimeClientError('invalid_argument', `${file} is not a file inside the worktree.`)
  }
  return relative.split(path.sep).join('/')
}

function requireLine(ctx: HandlerContext, name: string): number {
  const line = getOptionalPositiveIntegerFlag(ctx.flags, name)
  if (line === undefined) {
    throw new RuntimeClientError('invalid_argument', `Missing --${name}.`)
  }
  return line
}

function defaultAgentName(): string {
  return process.env.CLAUDECODE === '1' ? 'Claude Code' : 'Agent'
}

function lineLabel(note: Pick<DiffComment, 'startLine' | 'lineNumber'>): string {
  return note.startLine !== undefined && note.startLine !== note.lineNumber
    ? `${note.startLine}-${note.lineNumber}`
    : `${note.lineNumber}`
}

function formatNoteRow(note: DiffComment): string {
  const author = note.agentAuthor ? `[${note.agentAuthor.name}] ` : ''
  return `${note.id}  ${note.filePath}:${lineLabel(note)}  ${author}${note.body.replace(/\s+/g, ' ')}`
}

function formatNoteList(result: NoteListResult): string {
  return [
    `User notes (${result.userNotes.length})`,
    ...result.userNotes.map(formatNoteRow),
    `Agent notes (${result.agentNotes.length})`,
    ...result.agentNotes.map(formatNoteRow)
  ].join('\n')
}

export const NOTES_HANDLERS: Record<string, CommandHandler> = {
  'notes add': async (ctx) => {
    const worktree = await getNotesWorktreeSelector(ctx)
    const startLine = requireLine(ctx, 'line')
    const endLine = getOptionalPositiveIntegerFlag(ctx.flags, 'end-line')
    if (endLine !== undefined && endLine < startLine) {
      throw new RuntimeClientError('invalid_argument', '--end-line must not be before --line.')
    }
    const body = getRequiredStringFlag(ctx.flags, 'body')
    const agent = getOptionalStringFlag(ctx.flags, 'agent') ?? defaultAgentName()
    const filePath = await resolveNoteFilePath(
      ctx,
      worktree,
      getRequiredStringFlag(ctx.flags, 'file')
    )
    const response = await ctx.client.call<{ note: DiffComment }>('agentNote.add', {
      worktree,
      filePath,
      ...(endLine !== undefined && endLine !== startLine
        ? { startLine, line: endLine }
        : { line: startLine }),
      body,
      agent
    })
    printResult(
      response,
      ctx.json,
      ({ note }) => `Added agent note ${note.id} on ${note.filePath}:${lineLabel(note)}.`
    )
  },
  'notes list': async (ctx) => {
    const worktree = await getNotesWorktreeSelector(ctx)
    const response = await ctx.client.call<NoteListResult>('agentNote.list', { worktree })
    printResult(response, ctx.json, formatNoteList)
  },
  'notes rm': async (ctx) => {
    const worktree = await getNotesWorktreeSelector(ctx)
    const id = getRequiredStringFlag(ctx.flags, 'id')
    const response = await ctx.client.call<{ removed: boolean }>('agentNote.remove', {
      worktree,
      id
    })
    if (!response.result.removed) {
      throw new RuntimeClientError('not_found', `No agent note ${id} in this worktree.`)
    }
    printResult(response, ctx.json, () => `Removed agent note ${id}.`)
  }
}
