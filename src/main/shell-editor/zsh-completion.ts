import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnProcess } from '@orca/process-host'
import type { PipedChildProcess } from '@orca/process-host/process-spec'
import { ZSH_COMPLETION_DRIVER, ZSH_COMPLETION_INIT } from './zsh-completion-scripts'

/** `tag` is zsh's completion tag for the candidate, such as `local-directories` or `commands`. */
export type ZshCompletion = { value: string; description: string | null; tag: string | null }

export type ZshCompletionWorker = {
  complete: (request: { cwd: string; line: string }) => Promise<ZshCompletion[]>
  warm: () => void
  dispose: () => void
}

const DONE_MARKER = '__ORCA_COMPLETION_DONE__\n'
const FIELD_SEPARATOR = '\u001f'
const FIRST_REQUEST_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 4_000
const MAX_CANDIDATES = 500

export function parseZshCompletions(text: string): ZshCompletion[] {
  const seen = new Set<string>()
  const items: ZshCompletion[] = []
  for (const row of text.split('\n')) {
    const [rawValue, rawDescription, rawTag, ...rest] = row.split(FIELD_SEPARATOR)
    if (rawDescription === undefined || rest.length > 0) {
      continue
    }
    const value = sanitizeCompletionInput(rawValue)
    const description = sanitizeCompletionInput(rawDescription).trim()
    const tag = sanitizeCompletionInput(rawTag ?? '').trim()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    items.push({ value, description: description || null, tag: tag || null })
    if (items.length >= MAX_CANDIDATES) {
      break
    }
  }
  return items
}

// Why: the hidden zsh reads raw keys, so a CR or control key in the line would run or edit it.
export function sanitizeCompletionInput(text: string): string {
  // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
  return text.replace(/[\u0000-\u001f\u007f]/g, '')
}

function zshProgram(): string {
  const shell = process.env.SHELL
  return shell?.endsWith('/zsh') ? shell : '/bin/zsh'
}

type Pending = {
  resolve: (items: ZshCompletion[]) => void
  timer: ReturnType<typeof setTimeout>
}

export function createZshCompletionWorker(options: {
  scriptDir: string
  zshArgs?: string[]
}): ZshCompletionWorker {
  let child: PipedChildProcess | null = null
  let output = ''
  let ready = false
  let pending: Pending[] = []

  const reset = (): void => {
    child?.kill()
    child = null
    output = ''
    ready = false
    const waiting = pending
    pending = []
    for (const request of waiting) {
      clearTimeout(request.timer)
      request.resolve([])
    }
  }

  const onOutput = (chunk: Buffer | string): void => {
    output += chunk.toString()
    let at = output.indexOf(DONE_MARKER)
    while (at !== -1) {
      const answer = output.slice(0, at)
      output = output.slice(at + DONE_MARKER.length)
      if (ready) {
        const request = pending.shift()
        if (request) {
          clearTimeout(request.timer)
          request.resolve(parseZshCompletions(answer))
        }
      } else {
        ready = true
      }
      at = output.indexOf(DONE_MARKER)
    }
  }

  const start = (): PipedChildProcess => {
    if (child) {
      return child
    }
    mkdirSync(options.scriptDir, { recursive: true })
    const initPath = join(options.scriptDir, 'completion-init.zsh')
    const driverPath = join(options.scriptDir, 'completion-driver.zsh')
    writeFileSync(initPath, ZSH_COMPLETION_INIT)
    writeFileSync(driverPath, ZSH_COMPLETION_DRIVER)
    const spawned = spawnProcess({
      program: zshProgram(),
      args: ['-f', driverPath],
      cwd: options.scriptDir,
      env: {
        ...process.env,
        ORCA_COMPLETION_INIT: initPath,
        ORCA_COMPLETION_DUMP: join(options.scriptDir, 'zcompdump'),
        ORCA_COMPLETION_ZSH_ARGS: (options.zshArgs ?? ['-i']).join(' ')
      },
      stdio: 'pipe'
    })
    spawned.stdout.on('data', onOutput)
    spawned.on('exit', () => {
      if (child === spawned) {
        reset()
      }
    })
    spawned.on('error', () => {
      if (child === spawned) {
        reset()
      }
    })
    child = spawned
    return spawned
  }

  return {
    complete: ({ cwd, line }) => {
      const cleanLine = sanitizeCompletionInput(line)
      const cleanCwd = sanitizeCompletionInput(cwd)
      if (!cleanLine.trim()) {
        return Promise.resolve([])
      }
      const firstRequest = child === null || !ready
      const running = start()
      return new Promise((resolve) => {
        const timer = setTimeout(
          () => reset(),
          firstRequest ? FIRST_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS
        )
        pending.push({ resolve, timer })
        running.stdin.write(`${cleanCwd}\n${cleanLine}\n`)
      })
    },
    warm: () => {
      start()
    },
    dispose: reset
  }
}
