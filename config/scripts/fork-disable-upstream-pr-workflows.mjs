#!/usr/bin/env node
// Disables every upstream workflow that runs on pull requests, on this fork's GitHub repository.
// The fork's pull requests are verified by fork-verify.yml alone.
//
// Why disable rather than delete or edit: every workflow except the fork's own is taken verbatim
// from upstream on each sync (FORK.md, "Upstream is the source of truth"), so an edited or deleted
// file would conflict every time. Disabling is repository state that no merge touches. A sync can
// still bring in a new pull-request workflow, which starts enabled, so the sync runs this after
// every merge. It is idempotent.
//
// usage: node config/scripts/fork-disable-upstream-pr-workflows.mjs [--dry-run]
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'

const REPO = 'frbarbre/orca'
const FORK_WORKFLOWS = new Set(['fork-verify.yml', 'fork-preview-release.yml', 'fork-release.yml'])
const PR_EVENTS = ['pull_request', 'pull_request_target']
const dryRun = process.argv.includes('--dry-run')

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' })
}

function triggers(file) {
  const on = parse(readFileSync(`.github/workflows/${file}`, 'utf8'))?.on
  if (typeof on === 'string') {
    return [on]
  }
  return Array.isArray(on) ? on : Object.keys(on ?? {})
}

const prWorkflows = readdirSync('.github/workflows')
  .filter((file) => /\.ya?ml$/.test(file) && !FORK_WORKFLOWS.has(file))
  .filter((file) => triggers(file).some((event) => PR_EVENTS.includes(event)))

const listing = gh([
  'api',
  '--paginate',
  `repos/${REPO}/actions/workflows?per_page=100`,
  '--jq',
  '.workflows[] | [(.path | ltrimstr(".github/workflows/")), .state] | @tsv'
])
const states = new Map(
  listing
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))
)

for (const file of prWorkflows) {
  const state = states.get(file)
  if (state === undefined) {
    // GitHub registers a workflow only once it is on the default branch; the next run catches it.
    console.log(`not yet on GitHub: ${file}`)
  } else if (state === 'active') {
    if (!dryRun) {
      gh(['workflow', 'disable', file, '--repo', REPO])
    }
    console.log(`${dryRun ? 'would disable' : 'disabled'}: ${file}`)
  } else {
    console.log(`already ${state}: ${file}`)
  }
}
