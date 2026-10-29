import type { TriagedCheck } from './ci-triage'

/** What a CI triage look at a PR decided; `launched` and `launch-failed` follow a `started`. */
export type CiTriageDecision =
  | 'no-linked-failure'
  | 'rerunning'
  | 'no-workspace'
  | 'already-triaged'
  | 'cap-reached'
  | 'not-author'
  | 'started'
  | 'launched'
  | 'launch-failed'

/** Which path asked: the red-PR watcher, or a checks fetch such as an open PR tab's. */
export type CiTriageTrigger = 'watch' | 'checks'

export type CiTriageLogEntry = {
  decision: CiTriageDecision
  trigger: CiTriageTrigger
  repoId: string
  prNumber: number
  branch: string
  headSha: string | null
  /** The failed checks it was shown, links and all. */
  failed: TriagedCheck[]
  /** The runs a started agent is told about. */
  runs?: TriagedCheck[]
  worktreeId?: string
  prStarts?: number
  error?: string
}

/** As written to `logs/ci-triage.jsonl`: when, and which window and app process wrote it. */
export type CiTriageLogRecord = CiTriageLogEntry & {
  at: string
  window: string
  pid: number
  version: string
}

export type CiTriageApi = {
  log: (entry: CiTriageLogEntry & { at: string; window: string }) => Promise<void>
}
