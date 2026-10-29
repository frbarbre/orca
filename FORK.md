# Fork guidance

This is a fork of `stablyai/orca`. It carries a small, deliberate set of changes on top of upstream
and is otherwise meant to stay identical to it.

**Read this before resolving any merge conflict from upstream.** The default answer is "take
upstream". Only the changes listed in [What this fork owns](#what-this-fork-owns) are ours to keep,
and each one says how to re-apply it if upstream has moved the code underneath it.

## The merge

```bash
# Idempotent: a fresh clone has no upstream remote, and FORK.md used to assume one.
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/stablyai/orca.git
git fetch upstream main --no-tags
git fetch origin --tags            # release tags live on GitHub; the notes script needs them

git switch -c sync/upstream-<version> main
git merge upstream/main
```

Merge on a branch, never straight onto `main`, and fast-forward `main` only once
[Verify](#verify) is green — a broken `main` produces a broken release, and the release is the only
way this fork reaches the machine it runs on.

Push the branch and open a pull request against `main`; Verify runs there on GitHub's runners as the
`fork verify` check. When it is green, fast-forward `main` to the branch head with
`git push origin HEAD:main` (GitHub then marks the pull request merged). **Never merge it through
GitHub's merge button**: squash and rebase rewrite upstream's commits, and a merge commit puts one
more commit on `main` than the check verified.

Four things learned the hard way on the first sync:

- **Adding the `upstream` remote silently re-points `gh` at `stablyai/orca`.** `gh` resolves its
  default repository from the remotes and prefers one named `upstream`, so right after the first
  `git remote add` a plain `gh workflow run fork-release.yml` targeted upstream's repository (it
  404'd, so nothing ran). Pin it once, and pass `--repo` in anything scripted:

  ```bash
  gh repo set-default frbarbre/orca
  ```

- **Commit the merge with `--no-verify`.** The pre-commit hook runs `oxfmt --write` on every staged
  file, and a merge stages thousands of upstream files; the hook reformats them and the merge commit
  fills with formatting churn that conflicts on every later sync. Upstream's bytes go in verbatim.
- **Never run `oxfmt` (or any formatter) on a directory.** Upstream's tree is not oxfmt-clean at every
  commit, so formatting a directory rewrites files the fork never touched. Format only the files you
  edited, by path.
- **Keep the merge commit to the merge.** Resolve conflicts in it; put any fork fix the merge surfaces
  in its own commit after it, so the merge stays readable as "upstream, plus these resolutions".

## Upstream is the source of truth

For anything not listed in the next section, take upstream's side outright. In particular, resolve
these with `git checkout --theirs` without reading the diff:

- `package.json` and `pnpm-lock.yaml`, including the `version` field. `package.json` always carries
  upstream's version — that is how a release knows which Orca it is based on. The fork's own version
  line lives in its release tags, not in this file (see [Releasing](#releasing)).
- `src/i18n/locales/**` and any other generated or extracted file — **then run
  `pnpm run sync:localization-catalog`**. The fork owns catalog entries for its own strings, taking
  upstream's catalog drops them, and `pnpm lint` fails on every fork key missing from it.
- Every workflow in `.github/workflows/` except `fork-release.yml`, `fork-preview-release.yml` and
  `fork-verify.yml`.
- `docs/**`, and every test file except the four named below.
- Any file where our only "change" is formatting from a pre-commit hook.

If a conflict is in a file this document does not mention, that is the answer: take upstream's.

## What this fork owns

Two kinds. The updater group is what makes this fork a distinct app that updates from its own
releases — losing it silently turns the fork back into stock Orca on the next update check. The
rest is feature work.

### 1. Fork update channel — keep, and check carefully

**Rule: keep the indirection, keep upstream's default.** This is the one thing most likely to be
resolved wrongly, because the natural instinct is to "fix" the defaults to point at this fork.

Every release URL in the updater reads an env var and **falls back to upstream's URL**. The renderer is the exception — it cannot read main's env — so it is armed from a build flag, `VITE_ORCA_RELEASES_REPO`, which `fork-release.yml` sets on the build step:

```ts
function repoBase(): string {
  return process.env.ORCA_RELEASES_REPO_URL ?? 'https://github.com/stablyai/orca'
}
```

The fork is selected at runtime by `armForkUpdateChannel()`, which sets the env vars for packaged
builds only. Keeping the defaults upstream is what lets every updater module and its tests stay
exactly as upstream wrote them; re-pointing the literals instead means editing nine test files and
re-resolving them on every merge.

Two rules, both learned the hard way:

1. **The default stays `stablyai`.** The instinct to "fix" it to this fork is what breaks the merge
   story.
2. **Read the env var per call, never at module scope.** ES imports are evaluated before the
   importing module's body, so a module-level `const` resolves _before_ `armForkUpdateChannel()` can
   arm it — a fork build then silently checks upstream's releases and offers an upstream version.
   `src/main/updater-fork-feed-lazy.test.ts` guards this; do not collapse those functions to consts.

| File                                                                            | What is ours                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/updater/updater-manual-install.ts`                                    | Whole file (new). `armForkUpdateChannel` + the manual-install helpers.                                                                                                                                                  |
| `src/main/index.ts`                                                             | The `armForkUpdateChannel(app.isPackaged)` call and its import. If upstream restructures startup, move the call — keep it before any updater setup runs.                                                                |
| `src/main/updater/updater-setup.ts`                                             | `ORCA_UPDATE_FEED_URL ??` on the feed URL, and the `!isManualInstallOnlyUpdate()` term in `autoInstallOnAppQuit`.                                                                                                       |
| `src/main/updater/updater-release-feed.ts`                                      | The `ORCA_UPDATE_FEED_URL` early return ahead of upstream's stable-tag fallback.                                                                                                                                        |
| `src/main/updater-release-repo.ts` (new), `src/main/updater-prerelease-feed.ts` | `repoBase()` / `atomFeedUrl()` / `releasesDownloadBase()` / `tagHrefPattern()` and the patterns derived from them, imported by the feed. Upstream hardcodes the slug; keep it derived, and keep these as **functions**. |
| `src/main/updater/updater-download-install.ts`                                  | The `isManualInstallOnlyUpdate()` early return at the top of `downloadUpdate` and `quitAndInstall`.                                                                                                                     |
| `config/electron-builder.config.cjs`                                            | `owner: process.env.ORCA_PUBLISH_OWNER ?? 'frbarbre'` and `releaseType: … : 'release'`.                                                                                                                                 |
| `.github/workflows/fork-release.yml`                                            | Whole file (new).                                                                                                                                                                                                       |
| `config/scripts/fork-release-notes.mjs` (+ test)                                | Whole file (new). Resolves the fork version and writes the two-part release notes.                                                                                                                                      |
| `config/scripts/test-fork-features.sh`                                          | Whole file (new). Runs every test a fork commit touched; part of [Verify](#verify).                                                                                                                                     |
| `.github/workflows/fork-verify.yml`                                             | Whole file (new). [Verify](#verify) on pull requests.                                                                                                                                                                   |
| `config/scripts/fork-disable-upstream-pr-workflows.mjs`                         | Whole file (new). Keeps upstream's pull-request workflows disabled on this repository.                                                                                                                                  |
| `src/shared/release-channel.ts`                                                 | `setMainReleaseRepoOverride` and the `mainReleaseRepo()` it feeds. `MAIN_RELEASE_REPO` itself stays upstream's — same rule as the updater URLs.                                                                         |
| `src/renderer/src/main.tsx`                                                     | Arms that override from `VITE_ORCA_RELEASES_REPO`. The renderer cannot read the main process's env, so release-notes links there resolved to upstream's repo — a 404 for every fork-only version.                       |

#### The fork installs its own updates (macOS)

The app used to only notify, because macOS hands the swap to Squirrel.Mac and Squirrel refuses a
bundle whose signature it cannot validate. The way past that is not to sign — it is not to involve
Squirrel. `fork-install/` downloads the release zip, replaces `/Applications/Orca.app` itself and
relaunches. Manual install stays the fallback (`ORCA_UPDATE_NO_SELF_INSTALL=1`).

Four things verified on a real machine before this was written, each of which the design depends on:

- **No `sudo`.** `/Applications` is `drwxrwxr-x root:admin` and the user is in `admin`, so an app
  they installed can replace its own bundle with no password prompt.
- **A detached child outlives the app.** `spawn(..., { detached: true, stdio: 'ignore' })` plus
  `unref()` survives the parent exiting, which is precisely what the script waits for.
- **Downloading in-process avoids Gatekeeper entirely.** `com.apple.quarantine` is set by the
  _downloader_, not by the act of downloading; a file written by Node gets only
  `com.apple.provenance`, which Gatekeeper does not act on. The script still strips quarantine
  defensively.
- **`codesign -v` cannot be the gate.** It fails on a perfectly good install of this fork — "code
  has no resources but signature indicates they must be present" — because the bundles are ad-hoc
  signed without sealed resources. Integrity is the manifest's **sha512**, checked before anything
  is swapped; the script then only checks that the archive expanded into something launchable.

The swap moves the old bundle to `Orca.app.previous` rather than deleting it, so a failed install is
one `mv` from recovery, and every failure path relaunches the version that is still installed.
`ditto` does the expanding, not `unzip`, which does not preserve bundle symlinks or permissions.

| File                                           | What is ours                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/updater/fork-install/*` (+ tests)    | Whole directory (new): manifest parsing, the checksum-gated download, the settings backup, the swap script and the orchestrator. |
| `src/main/updater/updater-manual-install.ts`   | Arms `ORCA_UPDATE_SELF_INSTALL` on macOS.                                                                                        |
| `src/main/updater/updater-download-install.ts` | The self-install branch of `downloadUpdate`, and the early return in `quitAndInstall`.                                           |

Two things that are **not** ours and must not be changed:

- `appId` stays `com.stablyai.orca`. Changing it orphans the installed app's settings and worktrees.
- The signing/notarization config. This fork builds unsigned; that is why it notifies instead of
  installing. Do not enable `ORCA_MAC_RELEASE` without real Apple credentials.

### 2. Editor: changed-file navigation and review-comment links

Feature work. Keep it, but rebase it onto upstream's version of each file rather than keeping our
whole file — upstream owns these modules and changes them often.

New files (no conflict unless upstream adds the same path):

- `src/renderer/src/store/slices/editor/actions/open-diff-at-location.ts`
- `src/renderer/src/store/slices/editor/actions/step-to-changed-file.ts`
- `src/renderer/src/store/slices/editor/actions/changed-file-order.ts` (+ its test)
- `src/renderer/src/lib/source-control-review-order.ts`
- `src/renderer/src/components/editor/useDiffViewerPendingRevealScroll.ts`
- `src/renderer/src/components/right-sidebar/checks-panel/use-comment-location-opening.ts`
- `src/renderer/src/components/editor/changed-file-hold-navigation.ts` — the window-level session
  that keeps a held file-nav chord stepping across diff remounts
  (+ `changed-file-navigation-shortcut.test.ts`)
- `src/renderer/src/components/editor/diff-change-step.ts` (+ its test) — no-wrap change stepping
- `src/renderer/src/components/editor/diff-shortcuts-outside-editor.ts` (+ its test) — keeps the
  change, file and Add Review Note shortcuts working while focus is outside the diff editor: it
  focuses the open diff editor and re-sends the key to it, or, with no diff open, steps to the
  first/last changed file. It stands aside inside text fields, and a binding without Cmd/Ctrl/Alt
  only acts when nothing holds focus, so bare-arrow bindings never take keys from lists or menus.
  That same rule covers a closed comment popover, which leaves focus on nothing.

Modified files, and what to re-apply:

| File                                                                                                | What is ours                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/keybindings/types.ts`                                                                   | `editor.previousFile` / `editor.nextFile` in the action union.                                                                                                                                                                                                                                                                                                            |
| `src/shared/keybindings/definitions-core-4.ts`                                                      | The two definitions. **These files have a 300-line ESLint cap** — if upstream has grown this one, move ours to whichever `definitions-core-*.ts` has room.                                                                                                                                                                                                                |
| `src/renderer/src/components/editor/editor-shortcuts.ts`                                            | `installChangedFileNavigationShortcut`, including the `beginChangedFileHold` call on a fresh press. `installMonacoDiffChangeNavigationShortcut` stays upstream's.                                                                                                                                                                                                         |
| `src/renderer/src/components/editor/diff-navigation-context.tsx`                                    | The file-nav listener and the `registerDiffEditorForOutsideShortcuts` registration, installed and torn down on the same seam as the change-nav one. The change-nav shortcut is handed an adapter whose `goToDiff` is `goToDiffWithoutWrap`, and the header buttons call `goToDiffWithoutWrap` too — this is what stops Monaco wrapping from the last change to the first. |
| `src/renderer/.../store/slices/editor/types/editor-files-slice.ts`                                  | `stepToChangedFile` and its `options?: ChangedFileStepOptions` (`wrap: false` for a held chord).                                                                                                                                                                                                                                                                          |
| `src/renderer/src/components/editor/DiffViewer.tsx`                                                 | `useDiffViewerPendingRevealScroll` + the `hasPendingReveal` argument.                                                                                                                                                                                                                                                                                                     |
| `src/renderer/src/components/terminal-workspace-editor-shortcuts.ts`                                | The `handleDiffShortcutOutsideEditor` call at the top of `handleTerminalWorkspaceEditorShortcut`.                                                                                                                                                                                                                                                                         |
| `src/renderer/src/components/editor/useDiffViewerFirstChangeAutoScroll.ts`                          | The `hasPendingReveal` input that makes the auto-scroll stand down.                                                                                                                                                                                                                                                                                                       |
| `src/renderer/src/components/editor/monaco-reveal.ts`, `use-monaco-reveal-scheduler.ts`             | Type widened from `IStandaloneCodeEditor` to `ICodeEditor` so the diff editor can reuse the scheduler.                                                                                                                                                                                                                                                                    |
| `src/renderer/src/components/virtualized-list.tsx`                                                  | `scrollToRowKey`, `alignRowWithinScrollPadding`, and the flow-path wrapper — rendered **only when a caller passes `scrollToRowKey`**, so every other list keeps upstream's bare fragment. Heavily edited — merge with care.                                                                                                                                               |
| `src/renderer/.../checks-panel/comment-row.tsx`, `comment-group.tsx`, `use-comments-list-state.tsx` | The `onOpenLocation` prop and the clickable path badge.                                                                                                                                                                                                                                                                                                                   |
| `src/renderer/.../source-control/listing/*`                                                         | `activeOpenRowKey`, the branch-row `isOpenFile` highlight, the published review order in `use-published-review-order.ts`.                                                                                                                                                                                                                                                 |
| `src/renderer/.../source-control/panel/panel-ready.tsx`                                             | `scroll-pt-7` on the file-list scroller — reserves the sticky section header; the Commits dock sets the bottom padding (§35).                                                                                                                                                                                                                                             |
| `src/renderer/.../listing/active-open-file-keys.ts`                                                 | The `branch::<path>` key. Branch keys **must bypass** the availability filter.                                                                                                                                                                                                                                                                                            |

Four upstream **test** files carry our additions. Take upstream's version, then re-apply:

- `source-control-active-open-file-keys.test.ts` — the branch-key tests.
- `source-control-branch-section-heading.test.tsx`, `section-action-buttons.test.tsx` —
  `activeOpenRowKeys` / `activeOpenRowKey` props on the branch section.
- `diff-navigation-context.test.tsx` — the fake editor's `getModifiedEditor` and line-numbered
  `getLineChanges` (no-wrap stepping reads both), plus the "does not wrap" test.

### 3. Pull-request-driven workspace statuses

Watches each workspace's linked pull request and sets its board column, deletes the workspace once
its pull request is merged or closed, and opens a review workspace when someone asks you to review.
Configured per project under Settings → Automations, as a General tab plus one tab per state
(`PullRequestStatusRuleTabs.tsx`): each state's tab holds its column and whatever that state does
(`PullRequestStatusRuleStateSettings.tsx`; the review inbox in `ReviewingRuleSettings.tsx`, with
`reviewInbox.view` choosing how the review agent opens: Chat UI, Terminal, Claude web or the default).

Dev builds (`pnpm dev`) do not run the poller unless `localStorage['orca.devStatusRules'] = '1'`: they
share the workspace folder and GitHub account with the installed app, and a dev build that ticked
first once created a review workspace and ran its agent where nobody could see it.

**Merging** is the named approval-gate check passing, or — since that check runs a while after the
last approval — a PM team member and every other reviewer having approved with nobody still pending
(plain comments do not count). Without the second half, a pull request the PM just approved fell back
to Review until the gate ran.

**Conflicts** comes right after "You are the reviewer", so your own pull request with merge conflicts
lands there even as a draft. It reads GitHub's `mergeable`; while that is `UNKNOWN` (recomputing
after a push) the card holds still for a poll instead of bouncing out and back. Left unmapped, the
condition is skipped and nothing changes.

The reviewed commit is read from `latestOpinionatedReviews` as well as `latestReviews`: GitHub
leaves a re-requested reviewer out of `latestReviews`, and the re-request is exactly when that
commit is needed. The inbox ledger keys a re-request on it (`owner/repo#n@<sha>`), so a pull request
you reviewed is cloned again when it comes back; forgetting a pull request drops every such entry.

Everything the rules need comes from **one GraphQL query this fork owns** rather than from
upstream's `PRInfo`. That is deliberate: upstream's reviewer mapper drops team reviewers (it
requires a `login`, and a team only has a `slug`), its rollup normalizer rewrites every check name
to `check-<index>`, and it owns and frequently changes those files. Keeping our own query means the
whole feature lives in new files and costs one `gh` call per poll for the whole board.

New files (no conflict unless upstream adds the same path):

- `src/shared/workspace-status-rules.ts` (+ test) — the pure condition resolver. All the logic worth
  trusting is here; it takes a snapshot and returns a condition.
- `src/shared/workspace-status-rule-plan.ts` (+ test) — pure planner: targets + snapshot → status
  moves, removals, review-workspace creations. Every outstanding review request is cloned on the
  first tick; the `handledPullRequests` ledger is what stops a repeat, not a seeding step.
- `src/shared/workspace-status-rule-config.ts` — config type, defaults, persistence normalization.
- `src/main/github/review-base.ts` (+ a real-git test), `src/shared/github/review-base.ts`,
  `src/renderer/src/components/pending-review/use-review-base.ts` — the interdiff. When the author
  rebased after your review, or merged the target branch in, comparing against the reviewed commit
  pulls in everything the target branch gained. The test is whether the merge base with the target
  moved, not whether the reviewed commit left the branch: a merge keeps it in the branch. The reviewed version is replayed onto the branch's
  current base (`git merge-tree --merge-base`, then `commit-tree`) and saved as
  `refs/orca/review-base/<worktree>-<commit>`; a rebuild after another force-push gets a new name,
  because the branch compare caches by base ref. Local worktrees only: a remote runtime or SSH host
  keeps comparing against the reviewed commit.
- `src/shared/workspace-new-status-plan.ts` (+ test) — "New workspaces start in": a workspace Orca
  creates in a scoped project, with no column yet, goes into the chosen column. Only workspaces
  created after the column was chosen (`newWorkspaceStatusSince`, compared with `createdAt`) are
  moved, so choosing it never reshuffles the board.
- `src/renderer/src/components/pending-review/pending-review-summary-store.ts` (+ test) — each
  workspace's unsent review summary, stored beside its queued comments in the same device file
  (`summaries` next to `drafts` in `pending-review-drafts.json`, written through the same
  serialized read-modify-write in `src/main/github/pending-review-draft-store.ts`).
- `src/renderer/src/lib/reviewed-commit-bases.ts` (+ test) — the commits known to be ones you
  reviewed. Upstream's `resolveSourceControlBaseRef` swaps any worktree base pinned to a raw sha for
  the PR's base branch (a repair for old PR worktrees that pinned the head), which silently turned
  "since last review" back into the whole pull request. `use-base-refs.ts` compares against a pinned
  sha only when it is recorded here, so the repair still applies to every other pinned sha.
- `src/shared/workspace-status-rule-prompt.ts` (+ test) — the `{{variable}}` renderer. Orca has no
  other template engine; Quick Commands and Automations both store flat strings.
- `src/shared/github/review-status-snapshot-types.ts`, `src/shared/rpc-contract/workspace-status-rule-params.ts`
- `src/main/github/review-status-snapshot.ts`, `-query.ts`, `-mapping.ts` (+ tests, including
  `review-status-snapshot-merge-gate.test.ts`, which pins the merge gate as a commit status rather
  than a check run)
- `src/preload/api/review-status-rules-api.ts`, `-bridge.ts`
- `src/renderer/src/components/workspace-status-rules/*` — poller, target collection, plan
  application, review-workspace creation.
- `src/renderer/src/components/settings/PullRequestStatusRulesSection.tsx`, `PullRequestStatusRuleRows.tsx`,
  `pull-request-status-rule-copy.ts`
- `src/renderer/src/store/slices/ui/ui-slice-workspace-status-rule-actions.ts`
- `src/renderer/src/web/preload-api/web-review-status-rules-api.ts`

Modified files, and what to re-apply:

| File                                                                            | What is ours                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/persisted-ui-state-types.ts`                                        | `workspaceStatusRules?: WorkspaceStatusRuleConfig` and its import.                                                                                                                                                |
| `src/shared/rpc-contract/client-ui-params.ts`                                   | `workspaceStatusRules: WorkspaceStatusRules.optional()` and its import.                                                                                                                                           |
| `src/main/persistence/loading-store/normalize-loaded-ui-state.ts`               | One `normalizeWorkspaceStatusRuleConfig(...)` line in the returned object.                                                                                                                                        |
| `src/main/persistence/applying-settings/ui-state-read.ts`, `ui-state-update.ts` | One normalize line each, beside `workspaceStatuses`.                                                                                                                                                              |
| `src/renderer/.../source-control/sync/use-base-refs.ts`                         | `useIsReviewedCommit(normalizedWorktreeBaseRef)` and the `compareBaseRef` line that prefers a pinned reviewed commit. The PR/rebase target (`effectiveBaseRef`) stays upstream's.                                 |
| `src/main/git/source-control/branch-compare.ts`                                 | `isReviewBaseRef(baseRef) ? baseOid : resolveMergeBase(...)` — a review base is an exact base. Every diff consumer reads `summary.mergeBase`, so the file diffs follow.                                           |
| `src/main/startup/main-process-ipc-bootstrap.ts`                                | The `review-status-rules:snapshot` handler, and `pending-review:resolve-base` (registered-path check first).                                                                                                      |
| `src/preload/api-types.ts`, `src/preload/index.ts`                              | The `reviewStatusRules` member.                                                                                                                                                                                   |
| `src/renderer/src/web/web-preload-api.ts`                                       | `...createWebReviewStatusRulesApi()`.                                                                                                                                                                             |
| `src/renderer/src/store/slices/ui/ui-slice-contract-preferences.ts`             | The three `workspaceStatusRules` members.                                                                                                                                                                         |
| `src/renderer/src/store/slices/ui/ui-slice-hydration-actions.ts`                | One normalize line.                                                                                                                                                                                               |
| `src/renderer/src/store/slices/ui/ui-slice-preference-actions.ts`               | `...createUiWorkspaceStatusRuleActions(set, get)` as the first spread. **Deliberately not `ui.ts`** — inserting a line there drags upstream's pre-existing `as UISlice` cast into the changed-lines quality gate. |
| `src/renderer/src/components/settings/AutomationsSettingsPane.tsx`              | `<PullRequestStatusRulesSection />`.                                                                                                                                                                              |

Two upstream **test** files carry our additions. Take upstream's version, then re-apply:

- `web-preload-api-composition.test.ts` — `'reviewStatusRules'` in the expected namespace list.
- `AutomationsSettingsPane.test.tsx` — the store mock needs `workspaceStatusRules`,
  `workspaceStatuses`, `repos` and `setWorkspaceStatusRules`.

### 4. Review mode: pending comments and a submitted verdict

Queues inline review comments locally instead of posting each one immediately, then sends them as
one review with an approve / request-changes / comment verdict.

**The queue lives on the reviewer's device**, in `<userData>/pending-review-drafts.json`, written
through (serialized, atomic rename) on every edit so it survives a restart and a crash. It used to
live on the workspace's metadata, which fails for a workspace on a **remote runtime**: that
metadata belongs to the runtime, and a runtime running upstream Orca has no field for drafts, so its
`worktree.set` schema strips them and every edit was silently thrown away. Queued comments are the
reviewer's, not the workspace's, so they now never travel through a runtime at all. Drafts still
sitting on workspace metadata are adopted into the file the first time their workspace is opened,
then cleared there; until then the reviewed-removal guard counts both places.

Two things about the transport, both learned the hard way:

- The verdict goes through **GraphQL `addPullRequestReview`**, not REST. `gh api -f` sends strings
  only, so the nested `threads` array cannot be a variable, and `ghExecFileWithScopeAsync` accepts
  an `options.stdin` by inheritance but **never forwards it to the spawn**
  (`gh-exec-file.ts:187`), so `gh api --input -` silently sends an empty body. The input is
  therefore embedded in the mutation document, which is what `review-verdict-mutation.ts` builds
  and escapes.
- `hostedReview` already means _the pull request itself_ in this codebase, so this feature is named
  `pendingReviewComment` / `reviewVerdict` throughout. Do not rename it to "review".

New files (no conflict unless upstream adds the same path):

- `src/shared/github/pending-review-comment.ts` (+ test) — the queue model, its pure helpers and the
  wire types.
- `src/main/github/review-verdict-mutation.ts` (+ test) — the GraphQL document builder.
- `src/main/github/submit-review-verdict.ts` — the one `gh api graphql` call, rate-limit guarded.
- `src/preload/api/pending-review-api.ts`, `-bridge.ts`, and the web stub
  `web-pending-review-api.ts`.
- `src/renderer/src/components/pending-review/*` — the queue hook, the per-diff wrapper (which
  exists because inlining it tipped `DiffViewer.tsx` past its 400-line cap), the draft card and the
  submit action.
- `src/renderer/src/components/right-sidebar/source-control/pending-review/pending-review-shelf.tsx`.

Modified files, and what is ours:

| File                                                                                                                         | What is ours                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/worktree/types.ts`, `meta-types.ts`, `rpc-contract/worktree-params.ts`                                           | `pendingReviewComments` beside `diffComments`.                                                                                                                                                                                                                                                                                                                              |
| `ipc/worktree-metadata-merge.ts`, `ipc/worktrees/folder-workspace-model.ts`, `runtime/runtime-folder-workspace.ts`           | `pendingReviewComments` forwarded out of persisted metadata. **Every one of these has to list the field by name**: they rebuild the renderer's `Worktree` field by field, so one that is left out is written on every change and then dropped on the next launch, with nothing failing in between. Now read only to adopt drafts written before they moved onto the device. |
| `src/main/github/pending-review-draft-store.ts` (+ test), `components/pending-review/pending-review-draft-store.ts` (+ test) | New. The device-local queue: the file, and the renderer store that keeps an edit made before the first load finishes. Reached through `pending-review:drafts-read` / `-write` on the fork's own IPC surface, so no upstream persistence code is touched.                                                                                                                    |
| `DiffCommentPopover.tsx`                                                                                                     | `DiffCommentMode` gains `'pending'`, the third radio, and the relabelled `'review'` button ("Comment now").                                                                                                                                                                                                                                                                 |
| `DiffLineCommentPopoverHost.tsx`                                                                                             | The `onQueueForReview` prop and the third submit arm.                                                                                                                                                                                                                                                                                                                       |
| `use-diff-review-comment.ts`                                                                                                 | `resolveMode` falls back for any non-note mode, not only `'review'`.                                                                                                                                                                                                                                                                                                        |
| `inline-pr-comment-placement.ts` (+ test)                                                                                    | The placement union gains `kind`, and pending drafts are placed alongside threads.                                                                                                                                                                                                                                                                                          |
| `useInlinePRCommentZones.tsx`                                                                                                | The `pendingReview` input and the pending branch in `renderZone`.                                                                                                                                                                                                                                                                                                           |
| `editor/DiffViewer.tsx`                                                                                                      | The queue hook, `onQueueForReview`, and passing the queue to the zones.                                                                                                                                                                                                                                                                                                     |
| `source-control/panel/panel-ready.tsx`                                                                                       | The shelf, hidden at zero drafts like the notes shelf.                                                                                                                                                                                                                                                                                                                      |
| `source-control/listing/section-header.tsx`                                                                                  | An optional `className`, so the pending-review section can reuse the changed-file section header with its own spacing.                                                                                                                                                                                                                                                      |
| `src/preload/api-types.ts`, `index.ts`, `web/web-preload-api.ts`                                                             | The `pendingReview` member.                                                                                                                                                                                                                                                                                                                                                 |
| `src/renderer/src/components/ui/textarea.tsx`                                                                                | The `seamless` variant, so a composer can own the border and put its actions inside the same box. Added as a primitive variant because the design-system lint refuses that restyle at the call site.                                                                                                                                                                        |
| `checks-panel/comments-list.tsx`                                                                                             | `<PendingReviewPanelSection />` above the list.                                                                                                                                                                                                                                                                                                                             |
| `tab-bar/EditorFileTab.tsx` (+ its test's stub)                                                                              | The per-file pending badge beside the unresolved-thread one.                                                                                                                                                                                                                                                                                                                |
| `source-control/listing/*`, `panel/panel-content.tsx`                                                                        | `pendingReviewCountByPath` threaded to the file rows, mirroring `reviewThreadCountByPath`.                                                                                                                                                                                                                                                                                  |
| `src/main/startup/main-process-ipc-bootstrap.ts`                                                                             | The `pending-review:submit` and `pending-review:context` handlers.                                                                                                                                                                                                                                                                                                          |
| `src/renderer/src/components/ui/button.tsx`                                                                                  | The `ghost-destructive` variant.                                                                                                                                                                                                                                                                                                                                            |
| `src/renderer/src/components/ui/textarea.tsx`                                                                                | The `seamless` variant.                                                                                                                                                                                                                                                                                                                                                     |
| `src/renderer/src/lib/pr-comment-action-state.ts`                                                                            | The `'pending'` state.                                                                                                                                                                                                                                                                                                                                                      |
| `right-sidebar/pr-comment-presentation.ts`                                                                                   | `statusBadgePending` and `commentEditorText` (the editor used to hardcode a size, so editing shrank the text).                                                                                                                                                                                                                                                              |
| `checks-panel/comment-controls.tsx`                                                                                          | The Pending branch of `PRCommentActionBadge`.                                                                                                                                                                                                                                                                                                                               |
| `checks-panel/comment-row.tsx`                                                                                               | `forceMutable`, and the editor taking its type scale from the presentation.                                                                                                                                                                                                                                                                                                 |
| `checks-panel/comment-editor.tsx`                                                                                            | New. The body editor, lifted out because the row hit its 400-line cap. It grows to fit the draft up to 240px, then scrolls, and takes mod+Enter as submit (plain Enter is a newline — a comment is prose).                                                                                                                                                                  |
| `diff-comments/DiffCommentPopover.tsx`                                                                                       | `MODE_OPTIONS` and the segmented Agent/Comment/Review control.                                                                                                                                                                                                                                                                                                              |
| `diff-comments/use-diff-review-comment.ts`                                                                                   | Commentable lines seeded synchronously and `null` until known, so the popover does not open on the wrong destination and switch a frame later.                                                                                                                                                                                                                              |
| `diff-comments/diff-comment-zone-mouse-events.ts`, `useInlinePRCommentZones.tsx`                                             | `installDiffCommentZoneKeyStopper`, so a keystroke typed in a zone card does not also drive the editor.                                                                                                                                                                                                                                                                     |
| `editor/editor-shortcuts.ts`                                                                                                 | The typing-target guard on both diff navigation shortcuts.                                                                                                                                                                                                                                                                                                                  |

#### The diff base: since last review, or the whole pull request

A segmented control in the review shelf switches the workspace's `baseRef` between the commit the
viewer last reviewed (`viewerLatestReview.commit.oid`, free on the context query the banner already
makes) and `refs/remotes/origin/<base>`. The whole pull request is always the other tab rather than
an error path, because a force-push can strip the reviewed commit off the remote.

Before offering the tab, `use-commit-resolves.ts` probes the commit with the same branch compare the
diff itself would run. Note that git resolves a well-formed sha naming no object, so a force-pushed
commit comes back as **`no-merge-base`**, not `invalid-base` — `commit-resolution.ts` treats both as
missing, and that mapping is the thing to keep if this is ever rewritten.

| File                                                                                                                            | What is ours                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/components/ui/segmented-tabs.tsx`                                                                             | New. The Agent/Comment/Review control lifted out of `DiffCommentPopover` so the shelf can reuse it, plus `fullWidth`.                                            |
| `src/renderer/src/components/pending-review/use-review-diff-base.ts`, `use-commit-resolves.ts`, `commit-resolution.ts` (+ test) | New. The base switch and the reachability probe.                                                                                                                 |
| `src/main/github/review-verdict-mutation.ts`, `submit-review-verdict.ts`, `pending-review-api.ts`                               | `viewerLatestReview { commit { oid } }` and `baseRefName` on the context query.                                                                                  |
| `source-control/panel/branch-context-row.tsx`                                                                                   | A min height on the HEAD line. The line-total chip unmounts while a new base compares and the row is a hair taller with it, so the panel jumped on every switch. |

#### Editing a comment that is already on the pull request

GitHub lets the author rewrite an inline review comment, but orca only had an edit path for
top-level conversation comments (`isMutablePRConversationComment` refuses anything with a
`threadId` or a `path`). Inline comments now edit too, through the fork's own
`pending-review:update-comment` channel rather than a second REST namespace.

Three things worth keeping:

- The gate is **`viewerCanUpdate`**, which GitHub answers itself. Comparing the comment's author
  to the viewer's login cannot see organization or repository permissions.
- **Edit is offered where delete is not.** Orca has no path for removing an inline comment, so the
  more-menu gates the two actions separately.
- The mutation passes its body as a GraphQL **variable** (`gh api -f`), unlike the verdict, whose
  nested `threads` array has to be embedded in the document.

An `(edited)` marker comes from `lastEditedAt`, which the review-threads query now selects for
inline comments, conversation comments and review summaries alike.

| File                                                                                    | What is ours                                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/main/github/update-published-comment.ts`                                           | New. The `updatePullRequestReviewComment` mutation.                                        |
| `src/renderer/src/components/pending-review/editable-published-comment.ts` (+ test)     | New. The `viewerCanUpdate` gate.                                                           |
| `src/main/github/client/fetch/pr-review-threads-query.ts`                               | `lastEditedAt` and `viewerCanUpdate` on all three comment selections.                      |
| `src/main/github/client/fetch/get-pr-comments.ts`, `src/shared/github/comment-types.ts` | Those two fields mapped onto `PRComment`.                                                  |
| `checks-panel/comment-row.tsx`                                                          | `canEditComment` beside `canMutateComment`, and the `(edited)` marker in both layouts.     |
| `checks-panel/use-checks-panel-comment-mutations.tsx`                                   | The inline branch of `handleEditComment`.                                                  |
| `src/renderer/src/web/web-preload-api-composition.test.ts`                              | `pendingReview` added to the enumerated web surface — the review-mode merge left this red. |

#### Closing a review workspace once you have reviewed

`onReviewed: 'delete'` removes a workspace for someone else's pull request once you have
approved or requested changes on it, and a later re-request opens it again with the diff
pointed at the commit you last reviewed.

The mechanics are all in the ledger. `handledPullRequests` is what stops the inbox rebuilding
a workspace it already made, so a removal that should be reversible has to **forget** its key —
but only when the pull request is no longer listed as owed on that same tick, otherwise the
inbox clones it straight back. `readViewerReviewStanding` reads both halves, because GitHub
keeps a review after a re-request: a verdict alone never expires, what ends it is the viewer
reappearing among the pending reviewers.

The delete is guarded three ways: git refuses a checkout with uncommitted work or a live agent
(force stays off), and the plan refuses one holding unsent review comments, which live in
workspace metadata where git cannot see them.

| File                                                                                                                                   | What is ours                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/shared/workspace-status-rules.ts` (+ test)                                                                                        | `readViewerReviewStanding`.                                                                                  |
| `src/shared/workspace-status-rule-plan.ts` (+ test)                                                                                    | The reviewed-removal arm, `forgetHandledKey`, and `sinceReviewCommit` on a creation.                         |
| `src/shared/workspace-status-rule-config.ts`                                                                                           | `onReviewed`.                                                                                                |
| `review-status-snapshot-query.ts`, `-mapping.ts`, `review-status-snapshot-types.ts`                                                    | `commit { oid }` on `latestReviews`.                                                                         |
| `workspace-status-rules/apply-workspace-status-rule-plan.ts`, `create-review-workspace.ts`, `collect-workspace-status-rule-targets.ts` | Forgetting the key after a removal lands, the re-clone base, and the pending-comment guard.                  |
| `store/slices/ui/ui-slice-workspace-status-rule-actions.ts` + its contract                                                             | `forgetPullRequestHandled`.                                                                                  |
| `settings/PullRequestStatusRulesSection.tsx`                                                                                           | The toggle, and the second prompt box.                                                                       |
| `src/shared/workspace-status-rule-prompt.ts` (+ test)                                                                                  | `{{sinceCommit}}`, which falls back to the base branch so a first-look prompt never shows a raw placeholder. |

A re-request runs `reviewInbox.rereviewPromptTemplate` instead of the first-look prompt, because
the question is no longer "what does this change do" but "what did the author do about what you
already said". Both templates are editable in Automations, and clearing either restores its default.

#### Who is reviewing, and asking again

The review shelf lists the pull request's reviewers above the summary box, each with where they
stand, and a re-request button beside anyone who has already reviewed and is not requested now,
as GitHub's sidebar does. A re-requested reviewer drops out of `latestReviews` but stays in
`latestOpinionatedReviews`, so the pair is what tells a re-request from a first request.

The pull request facts behind the shelf (node id, head commit, reviewers) are fetched each time
the shelf loads rather than cached for the session, which had left the verdict and the reviewed
commit stale.

| File                                                                     | What is ours                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `src/shared/github/pull-request-reviewers.ts` (+ test)                   | `buildPullRequestReviewers`.                                  |
| `src/main/github/review-verdict-mutation.ts`, `submit-review-verdict.ts` | Reviewer fields on the facts query, and their parsing.        |
| `pending-review/use-submit-review-verdict.ts`                            | `reviewers` and `rerequest`, through `gh.requestPRReviewers`. |
| `source-control/pending-review/pending-review-reviewers.tsx` (+ test)    | The list.                                                     |

### 5. Editor theming from a VS Code theme file

Loads `~/.orca/themes/editor-dark.json` / `editor-light.json` (any VS Code theme) and registers them
with Monaco, so the editor and diff viewer are not stuck on stock `vs` / `vs-dark`.

No theme is committed, deliberately: a VS Code theme is someone else's work under someone else's
licence. The repo carries the loader, never the colours. Keep it that way.

New files (no conflict unless upstream adds the same path):

- `src/shared/vscode-theme.ts` (+ its test) — JSONC parsing and the VS Code → Monaco conversion.
- `src/main/editor-theme/custom-editor-theme.ts` — reads the files from `~/.orca/themes`.
- `src/renderer/src/lib/custom-editor-theme.ts` — registers once per session, picks the theme name.

Modified files, and what to re-apply:

| File                                                         | What is ours                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main/startup/main-process-ipc-bootstrap.ts`             | The `editor-theme:getCustom` handler.                                                                                                                                                                                          |
| `src/preload/api/app-api.ts`, `app-bridge.ts`                | The `getCustomEditorThemes` member and its `ipcRenderer.invoke`.                                                                                                                                                               |
| `src/renderer/src/web/preload-api/web-app-api.ts`            | The stub returning nulls — the web client has no `~/.orca`, and the type requires the member.                                                                                                                                  |
| `src/renderer/.../editor/DiffViewer.tsx`, `MonacoEditor.tsx` | `editorThemeName(...)` in place of the `'vs-dark' : 'vs'` ternary, plus the `ensureCustomEditorThemes()` effect. Both need the effect: `defineTheme` lands after first paint, and Monaco ignores a theme it does not yet know. |

### 6. Move between tab groups by direction

Cmd+Option+Arrow on macOS moves focus to the tab group on that side, as Warp does between its
panes. The target is the group with the nearest edge that shares part of the current group's side,
with no wrap-around; its active tab is activated and takes keyboard focus, and an empty group takes
focus itself. Linux and Windows ship unbound, since Ctrl+Alt+Arrow is the desktop's workspace
switch there.

The chords are worktree history's defaults too. Main yields them to the renderer, which alone knows
the layout: with two or more groups the arrows move between groups, and with a single group
Cmd+Option+Left/Right still go back and forward through worktree history.

Terminals, browsers and chats render in overlay layers above the group body rather than inside it,
so both "which group has focus" and "focus this group's content" are decided by geometry.

| File                                                                                  | What is ours                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/shared/keybindings/definitions-group-direction.ts`, `directional-group-focus.ts` | The four actions and their matcher.                      |
| `src/renderer/src/lib/tab-group-focus/` (+ tests)                                     | `findRectInDirection` and `focusTabGroupInDirection`.    |
| `src/main/window/main-window-shortcut-routing.ts`                                     | Yielding the chord to the renderer.                      |
| `app-shell/use-global-keybindings.ts`                                                 | Running the move, and the single-group history fallback. |

### 7. Linear title on workspace cards

Card display → "Linear title" adds the linked Linear issue's title as a line under the card's
branch row. Off by default. It reuses the card's existing Linear fetch, which now also runs when
only the title is shown.

| File                                                                                     | What is ours                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/ui-chrome-types.ts`, `src/shared/worktree/card-properties.ts`                | `'linear-title'` in the union and in `WORKTREE_CARD_PROPERTIES`.                                                                     |
| `sidebar/fork-card-property-options.ts`, one call in `sidebar-workspace-option-items.ts` | The menu option, slotted after upstream's shared Card display choices (`withForkCardDisplayOptions`). PR author rides the same list. |
| `sidebar/use-worktree-card-controller.ts`                                                | `showLinearTitle`, and fetching for it.                                                                                              |
| `sidebar/worktree-card-parent-content.tsx`, `worktree-card-linear-title.tsx` (+ test)    | The row.                                                                                                                             |

### 8. Review workspaces follow the pull request, and other PR automations

Each PR-rules tick also does three smaller things, all in `workspace-status-rules/`:

- **Head sync.** A local review workspace (someone else's open pull request) is moved onto the
  pull request's current head when it changes, including after a force-push. The main-process
  helper (`src/main/github/review-head-sync.ts`, real-git test) refuses when the checkout is on
  another branch or detached, has uncommitted changes, cannot fetch the head, or holds any
  local-only commit authored by the reviewer's `user.email` (or when that email is unset). The
  planner is `src/shared/github/review-head-sync.ts`; IPC `review-status-rules:sync-review-head`
  checks the path is a registered worktree first.
- **PR author avatars.** `pr-author-store.ts` keeps each linked pull request's author from the
  snapshot; Card display → "PR author" shows it (`worktree-card-pr-author.tsx`). Only for
  projects the PR rules cover.
- **Conflict agent.** With "Resolve conflicts with an agent" on, a workspace entering Conflicts
  gets an agent on `buildConflictAgentPrompt` — upstream's pull-request conflict prompt with its
  no-push rule swapped for "push, never force-push" (`launch-conflict-agents.ts`).
- **Review command.** "Run a command when your pull request enters Review" runs `reviewEnteredCommand`
  once in a local workspace entering the column mapped from `review` (`run-review-entered-commands.ts`).
  It runs headless in main (`src/main/github/workspace-command.ts`, bash with the app's environment,
  like setup hooks) behind IPC `review-status-rules:run-workspace-command`, which checks the path is a
  registered worktree first; a failure toasts the command's last output lines.

A review workspace is created in the background, so its setup and default tabs start through
`lib/launch-worktree-background-terminals.ts` (+ `background-pane-exit-output.ts`). Upstream deleted
both in #28130 when automations moved that work into main; the fork keeps its own copy for
`create-review-workspace.ts`.

### 9. Sidebar: hide temporary checkouts, and Run on a shortcut

"Hide temporary checkouts" hides worktrees under `/tmp`, `/private/tmp`, `/var/folders` or
`AppData\Local\Temp` (agents' scratch `git worktree add`s). It is threaded beside
`hideDetachedHeadWorkspaces` everywhere that flag goes, except the jump palette, whose file sits at
its line cap. The listing reads it from the store rather than `filterState`, so upstream's
filter-state types and tests stay as they are. Upstream's shared Workspace options evaluator
(`shared/workspace-view/workspace-row-filters.ts`) does not know the flag either: the predicate lives
in `sidebar/temporary-checkout-workspace.ts`, `compute-visible-worktrees.ts` filters after
`filterWorkspaceRows`, `sidebar-filter-actions.ts` counts and clears it beside the shared keys,
`use-filters.ts` reveals through `temporary-checkout-reveal.ts`, and both menus render
`temporary-checkout-filter-row.tsx` after the shared filter rows. The phone does not apply it.
`persisted-ui-write-baseline.test.ts` gains the field in its census fixture — re-apply after taking
upstream's version.

`tab.runQuickCommand` runs the tab group's Run-button command (`use-run-quick-command-shortcut.ts`).
It ships unbound because Cmd+R is upstream's `tab.rename`; bind it in keybindings.json.

### 10. Queue inline pull-request comments for the agent

Inline review threads in the diff get the PR panel's "Queue" toggle beside "Send to an agent"; the
panel keeps its "send queued comments" action. `pr-comments-list-selection.ts` now notifies
subscribers when the queue changes (so panel and diff stay in step), and exports a setter for one
thread. The panel's queue key folds in the pull request head, so the panel publishes it per
workspace (`pr-comment-queue-context.ts`, from `checks-panel/active-content.tsx`) and inline cards
read it from there — the toggle appears once the panel has shown that workspace's pull request.

### 11. @-mentions in pull request comment boxes

Typing `@` in the PR panel's comment and reply boxes (also used by inline threads), the comment
edit box (`checks-panel/comment-editor.tsx`, posted comments and queued drafts), the diff's
new-comment popover (review modes only, not agent notes) and the review summary lists the
repository's assignable members; Enter or Tab inserts `@login `. The list is portalled to the
body and anchored to the textarea, because every one of these boxes sits in an overflow-hidden
frame or a Monaco view zone. `github-mention-autocomplete.tsx`
lifts the behaviour of the pull request page's `MentionTextarea` into a hook, so each box keeps its
own textarea, and fetches members through `useRepoAssignees` only once `@` is typed.

### 12. Sending comments to an agent leaves them open

Upstream resolves every sent thread it can, and posts "Fixing" replies on the rest, as soon as the
agent starts. The fork skips that: `use-checks-panel-ai-acknowledgement.tsx` returns after clearing
the queue when `shouldAcknowledgeSentPRCommentsOnHost()` (`sent-pr-comment-acknowledgement.ts`)
says no, which it always does. Upstream's acknowledgement code is left intact below the early return.

### 13. Top bar actions: the next step for the workspace, and Review

Beside the right sidebar toggle (`right-sidebar/index.tsx` composes them into `closeButton`),
`workspace-actions/WorkspaceActionButtons.tsx` shows the one next step for the active workspace and,
when the branch has an open or draft pull request, a Review button. Each launches the review-inbox
agent in a new tab with a prompt:

- Priority (`src/shared/workspace-action.ts`, + test): a merge stopped on conflicts, then no pull
  request (Create PR, whose prompt commits and pushes the work first), then uncommitted or unpushed
  work (Commit & push), then pull request conflicts, then a draft (Ready for review). Nothing on the
  default branch or an open, clean pull request. Create PR waits for the `prCache` lookup to answer
  (an entry without an error), so a branch whose pull request has not loaded yet shows Commit & push.
- Prompts (`src/shared/workspace-action-prompts.ts`, + test) are editable under Automations → Top bar
  actions and stored in `workspaceStatusRules.actionPrompts`; Create PR fills in the Source Control
  PR instructions and PR creation defaults (draft, template). Resolve conflicts uses upstream's
  conflict prompts and the Source Control `resolveConflicts` template instead.
- GitHub pull requests only (read from `prCache`).
- The unpushed count is `remoteStatusesByWorktree`. For a worktree with a push target, upstream's
  automatic poll caches that comparison for 60s; the cache key also carries the porcelain tracking
  counts (`push-target-upstream-refresh-cache.ts`), so a push from a terminal clears Commit & push on
  the next poll instead of after the TTL.

### 14. Pick where the review diff starts

The shelf's "Since last review / Whole pull request" tabs are a select
(`pending-review/pending-review-diff-base-select.tsx`): "Since your last review" on top (the
default), then the pull request's commits newest first, each tagged with the reviews you left on it
("Review 1", "Review 2"…), reviews whose commit a rebase removed, and the pull request's target
branch last — the branch it merges into, which for a stacked PR is the one below, not `main`.

The PR context query also fetches `commits(last: 100)`, `reviews(last: 100)` and `viewer { login }`
(`main/github/review-history-parsing.ts`); `src/shared/github/review-history.ts` (+ test) numbers the
viewer's reviews and builds the options. `use-review-diff-base.ts` routes every choice but the target
branch through `resolveReviewBase`, so a commit picked after a rebase or a merge of the target still
gets an interdiff, and marks the commit as a reviewed base so upstream's pinned-sha repair leaves it.
A picked commit is inclusive: it goes to `resolveReviewBase` as `<oid>^`, which rev-parses it to the
parent, so that commit's own changes are in the diff (and the resolved parent is the sha marked). A
review stays exclusive — it is the point you already read up to. The list opens below the select
(`position="popper"`). The pick is kept per workspace for the session.

### 15. Paste and drop images and videos into review comments

Every GitHub-bound comment box (PR panel comments and replies, inline thread replies, the comment
edit box, the diff's new-comment popover in every mode, and the review summary) is
`github/ReviewMarkdownComposer.tsx`: upstream's TipTap `GitHubMarkdownComposer` with its toolbar
hidden (`showToolbar={false}`), grown to its content instead of scrolling (`growWithContent`), and two
extensions passed through the new `editorExtensions` prop:

- `review-asset-upload-extension.ts` takes pasted or dropped PNG/JPEG/GIF/WebP/MP4/MOV/WebM. An
  image shows at once from a `blob:` preview and swaps to its attachment URL when the upload lands. A
  video shows as an "Uploading …" widget decoration after its paragraph, never document text, and
  becomes its bare attachment link on its own line, which GitHub plays as a video. A text
  placeholder once went out in a review: autolink split `clip.mov` (`.mov` is a TLD) so the swap never
  found it. A pending counter drives `onUploadingChange`, and the wrapper also holds submit while the
  markdown still carries a `](blob:` link. It is off for agent notes, which stay local.
- `review-mention-extension.ts` reports an `@query` before the caret; the wrapper shows the shared
  `GitHubMentionList` of the active repository's members.

A focused contenteditable is not an owned text control, so the app-menu Cmd+V routing
(`lib/app-menu-paste.ts`) falls back to native paste, and the paste event carries the clipboard image.
The old textarea boxes read clipboard text only, which is why screenshots never pasted into them.

Files become **GitHub attachments**, the same kind the web editor and `gh --attach` (gh 2.99)
make, so GitHub renders them inline and nothing is hosted outside GitHub. `main/github/review-asset-
upload.ts` takes the ambient gh token (`resolveReleaseApiToken`), looks up the repository's numeric id
and push permission (`GET /repos/{owner}/{repo}`), and posts the bytes to
`https://uploads.github.com/user-attachments/assets?name=&content_type=&repository_id=`, which answers
`{ url: "https://github.com/user-attachments/assets/<uuid>" }`. It needs write access (the endpoint
answers 404 otherwise) and takes images up to 10 MB and videos up to 100 MB. The repository is the
pull request's `prRepo`, else the workspace remote's slug, so a fork's attachments belong upstream.

A private repository's attachment answers 404 without a github.com session, so the renderer never
loads it directly: `resolveGitHubAttachmentUrl` sends the token to exactly
`https://github.com/user-attachments/assets/<uuid>`, reads the 302 to GitHub's signed file storage
(`*.amazonaws.com` / `*.githubusercontent.com`, valid 5 minutes, cached 4), and hands that back
(`pending-review:asset-resolve`). `lib/github-attachment-src.ts` wraps it for the comment media
components and the editor's image node view (`rich-markdown-extensions.ts`), which keeps an upload's
local preview up until the signed URL arrives. An attachment it cannot resolve renders as a link.

An earlier version uploaded to a public Hetzner bucket through a Helios signer; that was removed with
its infrastructure, so the few bucket links posted in that window no longer load.

Upstream's unclaimed-drop guard (`os-file-drop-cancellation-guard.ts`) refuses any OS file drop no
owner claims, so `review-asset-drop-claim.ts` claims drags over a box with uploads on: it stops them
on the box after the editor's own drop handler, which also keeps an enclosing owner (the editor
group) from opening the files as tabs.

Rendering: the compact comment markdown (PR panel, inline diff threads) shows GitHub attachment
images and `uploads.linear.app` images besides its app-managed `blob:`/`data:` images; every other
remote image still renders as a link. Comments written in Linear sync to GitHub as `<img>` tags and
`[clip.mov](…)` links on `uploads.linear.app`, signed for a year and readable without a session.
Bare GitHub attachment links, and Linear upload links whose text is a video file name
(`isHostedVideoLink`), render as videos in both the compact and document renderers. Every image and video opens
full screen on click (`MarkdownImageLightbox.tsx`: `ExpandableMarkdownImage`,
`ExpandableMarkdownVideo`), and ← / → (or the side arrows) step through every image and video of the
same comment in document order, with a counter — `CommentMarkdown` wraps each comment in a
`MediaGalleryProvider` (`media-lightbox-gallery.tsx`, + test) the triggers register with, which replaced the old compact `expandImages` opt-in and the document
renderer's hand-off of image clicks to `onLinkClick`.

### 16. Share settings: export and import

Settings → General → Share settings writes one JSON file (`format: "orca-settings"`, `version: 1`)
a colleague imports on their machine. `src/shared/settings-transfer.ts` (+ test) decides what goes:

- **Settings**: everything but a denylist and name patterns (accounts, tokens, cookies, keys,
  secrets, paths and dirs, machine, proxy, runtime, WSL, devices, telemetry, pairing, repo and host
  ids, migration/defaulted/dismissed bookkeeping, internal terminal switches), applied at every
  nesting level, so a portable object still loses a private field such as a sound file's path.
  Quick commands scoped to a project are dropped; unscoped ones travel.
- **UI**: preferences only — board columns, sidebar and agents-view grouping and filters, card
  properties, status bar, zoom, browser defaults, pet — and the status rules minus `repoIds`, the
  handled-PR ledger and `newWorkspaceStatusSince`. `settings-transfer-ui-fields.ts` lists every
  `PersistedUIState` key as `true` (exported) or `false`, so a new key fails typecheck until it is
  classified.
- **Projects**: each project's portable settings (CI triage prompt, port labels command, base ref,
  hooks, source-control AI, relative symlink paths and venv, issue source, fork sync, worktree
  visibility, Jira project), keyed by the git remote's `canonicalKey` and applied on import to every
  local project with that remote, on every host. `settings-transfer-projects.ts` maps every `Repo`
  field to a parser (exported, and checked again on import) or `null` (local); the map `satisfies`
  every key of `Repo`, so a new field fails typecheck until it is classified. Folder workspaces and
  projects without a resolved remote are skipped.
- **Files**: `~/.orca/keybindings.json` and `~/.orca/themes/editor-{dark,light}.json`, when they are
  valid JSON (`main/settings-transfer/settings-transfer.ts`, + test).

Import re-filters the parsed file, so an edited export cannot plant a token or a path. Settings are
deep-merged onto the importer's own (their private nested fields survive), status rules keep their
projects and ledger (a new-workspace column only moves workspaces created after the import), and the
window reloads so every stored value goes through the normal hydration sanitizers.

### 17. Filter changed files by type

A dropdown under the commit button hides changed files by type — implementation, tests,
documentation, generated, agent guidance, localization, assets — across staged, unstaged,
untracked and committed-on-branch rows. It lists only the types present in the diff. Categories
follow [Linear's `.gitattributes` rules](https://linear.app/enablement/guide/diffs#organize-files-with-.gitattributes):
`review-<category>` and GitHub's `linguist-generated` / `linguist-documentation` add a category,
`-attr` / `attr=false` removes one (the file falls back to implementation). Without an attribute,
the branch line-total chip's `isGeneratedCodePath` / `isTestCodePath` heuristics decide.

Git answers the attributes (`git check-attr --stdin -z`), so nested `.gitattributes` files and
uncommitted edits to them count. It is a new read-only call on every route: IPC
`git:checkReviewAttributes`, runtime RPC and relay `git.checkReviewAttributes`. An older relay or
runtime without it errors, and the panel falls back to the path heuristics.

New files: `src/shared/git-review-attributes.ts` (+ test), `src/main/git/check-review-attributes.ts`
(+ real-git test), `src/main/ipc/filesystem/filesystem-git-review-attributes-handlers.ts`,
`src/relay/git-handler-check-attr.ts`, and in `source-control/listing/`: `file-category.ts` (+ test),
`file-category-filter.tsx`, `use-review-attributes.ts`, `use-file-projection-categories.test.tsx`,
`use-published-review-order.ts` (the review order, moved out of `use-file-listing.ts`), and
`tests/e2e/source-control-file-type-filter.spec.ts`.

| File                                                                                                                                                                                              | What is ours                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/ipc/filesystem.ts`                                                                                                                                                                      | The `registerFilesystemGitReviewAttributesHandlers` call.                                                                                                                                                               |
| `src/main/providers/git-provider-contract.ts`, `ssh-git-working-tree-provider.ts`                                                                                                                 | `checkReviewAttributes`.                                                                                                                                                                                                |
| `src/main/runtime/runtime-git-status-commands.ts`, `orca-runtime-git.ts`, `runtime-git-command-surface.ts`, `rpc/methods/git.ts`, `rpc/methods/git-params.ts`, `runtime-git-api-contract.test.ts` | `checkRuntimeGitReviewAttributes` and the `git.checkReviewAttributes` method.                                                                                                                                           |
| `src/shared/rpc-contract/git-params.ts`                                                                                                                                                           | `GitCheckReviewAttributes`; regenerate the catalog with `pnpm run generate:rpc-params-catalog`.                                                                                                                         |
| `src/relay/git-handler-read-operations.ts`, `git-handler-registration.ts`                                                                                                                         | `checkReviewAttributes` and its registration.                                                                                                                                                                           |
| `src/preload/api/git-bridge.ts`, `git-inspection-api.ts`, `src/renderer/src/web/preload-api/web-git-api.ts`                                                                                       | `checkReviewAttributes`.                                                                                                                                                                                                |
| `src/renderer/src/runtime/runtime-git-status-client.ts`, `runtime-git-client.ts`                                                                                                                  | `getRuntimeGitReviewAttributes`.                                                                                                                                                                                        |
| `source-control/panel/use-panel-view-state.ts`                                                                                                                                                    | `hiddenFileCategories` / `toggleFileCategory`, kept per worktree (`hiddenFileCategoriesByWorktree`) so each remembers its own filter; test `use-panel-view-state.file-types.test.ts`.                                   |
| `source-control/panel/use-panel-foundation.ts`, `listing/use-file-listing.ts`                                                                                                                     | Passing `hiddenFileCategories` and `reviewAttributes` into the projection.                                                                                                                                              |
| `source-control/listing/use-file-projection.ts`                                                                                                                                                   | `categoryGrouped` feeds both the text filter and `unfilteredDisplaySectionsById`, so section Stage all / Discard all / View all never act on hidden files. Branch entries are category-filtered before the text filter. |
| `source-control/panel/panel-content.tsx`, `listing/content-status.tsx`                                                                                                                            | The filter under the commit surface and the "All changed files are hidden" empty state.                                                                                                                                 |

### 18. Claude web view

A **View** submenu (tab and pane right-click menus) picks one of Terminal, Chat UI and Claude web.
Claude web covers a Claude Code pane with its claude.ai Remote Control page,
`https://claude.ai/code/<bridgeSessionId>`; the terminal and its process stay alive underneath, the
same way chat view does. Because the web view covers both other views, every choice clears it first
(`agent-view-choice.ts`) — two separate toggle items used to switch chat on underneath it.

Settings → Experimental → Chat UI → Default view has a third option, Claude web
(`openClaudeTabsInWebView`, fork-only; the select writes it only when Claude web is involved, so
upstream's `openAgentTabsInChatByDefault` writes are unchanged). With it on,
`use-claude-web-auto-open.ts` opens the web view once for a Claude session in a tab created during
this run — one observer instead of a hook in each launch path. The page waits up to 30 s for a young
session's Remote Control to connect (`claude-remote-session-poll.ts`, keyed off the session file's
`startedAt`); an older session without it reports Remote Control off at once.

Claude Code writes `sessions/<pid>.json` in its config dir (`CLAUDE_CONFIG_DIR` or `~/.claude`) for
each live process, with the hook `sessionId` and, while Remote Control is connected,
`bridgeSessionId`. That file is undocumented; if it moves, the cover says the session was not found.
An SSH workspace's file lives on the remote host: the renderer passes the tab's host id and
`claude-remote-session-url-ssh.ts` prints the matching files over the SSH connection (POSIX hosts;
a Windows host reports not found). A main process without `hostId` support ignores it and reads
locally, as before.

It deliberately does not add a `viewMode` value: `viewMode` is persisted, sanitized to
`'terminal' | 'chat'` and mirrored to mobile and runtime hosts. The web view is renderer state
(`claude-web-view-state.ts`), remembered per tab in `localStorage` across reloads and restarts; it
is dropped only on proof (Claude exited to the shell, or the pane is gone), never because the session
has not been reported yet after a reload. With the web view over a tab's only pane, the pane header
(its corner buttons) is not drawn. The `<webview>` uses the default
browser profile's partition, so a claude.ai login in Orca's browser carries over. A split or pane
move reparents the pane container and reloads the page.

There is no toolbar; switching back is the View submenu, or the button on the error card.
Keyboard: the cover carries `native-chat-pane-shell`, the "terminal is covered" marker, so the
hidden terminal's paste/copy/focus handlers stand aside. Edit ▸ Paste pastes straight into a focused
`<webview>` the focused window hosts (`app-menu-paste-item.ts`) — before, it went to the renderer,
whose fallback pasted into Orca's own window. The page is not a registered browser tab, so the
browser's allowlisted guest forwarding never sees it (and that allowlist lacks ⌘⇧G/⌘⇧E anyway).
`claude-web-guest-shortcuts.ts`, armed through the `claudeRemoteSession:attachGuest` IPC, reloads
the page on `browser.reload` / `browser.hardReload`, and sends any key matching a `global` or `tabs`
keybinding to the renderer, which replays it on `document.body` (`claude-web-key-replay.ts`) so
Orca's window keydown handlers run it with the user's rebinds. Modifier releases follow a forwarded
chord, for hold-to-switch. Page editing keys (copy, paste, undo) are in neither scope and stay put.
Window-level chords that the main window runs in main (`resolveWindowShortcutAction`: tab and
workspace number jumps, sidebars, palettes) go through `sendResolvedWindowShortcutAction` instead,
since a replayed key never reaches those handlers.

Opening the web view (View submenu, or auto-open) asks for the claude.ai prompt to take focus:
`claudeWebView.show(…, { focusPrompt: true })` queues a one-shot request, and on `dom-ready` a
visible (not `inert`) pane focuses the page and runs `claude-web-prompt-focus.ts` in it, which
polls up to 10 s for `[data-testid="code-prompt-input"]` (fallback `[role="textbox"][aria-label="Prompt"]`)
and puts the caret at the end. A view restored after a reload has no request and never takes focus.

Right-click: a `<webview>` shows no menu of its own, so `claude-web-context-menu.ts` (+ test), installed
on attach, pops a native menu built from the click: Cut/Copy/Paste in an editable field (enabled by the
page's edit flags), Copy for a selection, Open/Copy Link for an http(s) link, and Select All.

Links: claude.ai opens links in a new tab, which a `<webview>` drops unless the host handles it.
`claude-web-external-links.ts` (+ test), installed on attach, opens http(s) ones in the default
browser and denies every other window.

Window focus: terminal wake recovery refocuses the active pane on every window `focus`; for a pane
under the web view that meant the cover, which forwards to the page, which blurs Orca's window
mid-press and cancels a tab-strip click (the tab strip cancels a press on window blur). So clicks on
other tabs were randomly swallowed. `use-terminal-window-wake-recovery.ts` takes the tab's id and
treats a pane under `[data-claude-web-cover]` (`claude-web-covered-pane.ts`) as covered, like chat.

New files: `src/shared/claude-remote-session.ts`, `src/main/claude/claude-remote-session-url.ts`
(+ test), `src/main/claude/claude-web-guest-shortcuts.ts` (+ test), `src/main/menu/app-menu-paste-item.ts`, `src/main/ipc/claude-remote-session.ts`, `src/preload/api/claude-remote-session-bridge.ts`,
and in `src/renderer/src/components/terminal-pane/`: `claude-web-view-state.ts` (+ test),
`ClaudeWebView.tsx`, `AgentViewSubmenu.tsx`, `agent-view-choice.ts` (+ test),
`claude-remote-session-poll.ts` (+ test), `claude-web-key-replay.ts`, `use-claude-web-auto-open.ts`,
`claude-web-prompt-focus.ts`, `claude-web-covered-pane.ts`,
`TerminalPaneClaudeWebPortal.tsx`; plus `tests/e2e/claude-web-view.spec.ts`.

| File                                                                                                                             | What is ours                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/ipc/register-core-handlers/register-core-handlers.ts` (+ test)                                                         | `registerClaudeRemoteSessionHandlers(() => keybindings?.getOverrides())`: the keybinding service, as the main window reads, so rebinds reach the web view; the test passes a stand-in service and expects it in the dashboard popout call too. |
| `src/main/menu/register-app-menu.ts` (+ test)                                                                                    | The Paste item comes from `createAppMenuPasteItem` (new `app-menu-paste-item.ts`, which also holds upstream's paste routing); the test's "pastes natively into a focused guest webview" case.                                                  |
| `src/preload/api-types.ts`, `src/preload/index.ts`                                                                               | `claudeRemoteSession`.                                                                                                                                                                                                                         |
| `src/shared/global-settings-types.ts`, `default-global-settings.ts`                                                              | `openClaudeTabsInWebView`.                                                                                                                                                                                                                     |
| `src/renderer/src/components/settings/NativeChatExperimentalSetting.tsx`, `ClaudeWebDefaultViewSetting.tsx`                      | The "Open Claude in Claude web" switch (upstream removed the Default view select it used to be an option of).                                                                                                                                  |
| `src/renderer/src/components/terminal-pane/TerminalPaneSurface.tsx`                                                              | `<TerminalPaneClaudeWebPortal>`, the `claudeWebTabId` / `claudeWebLeafId` props and `webViewLeafId`.                                                                                                                                           |
| `src/renderer/src/components/terminal-pane/TerminalPaneHeaderOverlay.tsx`                                                        | The optional `webViewLeafId` prop and its single-pane early return.                                                                                                                                                                            |
| `src/renderer/src/components/terminal-pane/use-terminal-window-wake-recovery.ts` (+ test), `use-terminal-pane-global-effects.ts` | The optional `tabId` and the web-view clause beside the chat-cover check; the caller passes `tabId`.                                                                                                                                           |
| `src/renderer/src/components/terminal-pane/TerminalContextMenu.tsx`                                                              | The optional `claudeWeb*` props; `<AgentViewSubmenu>` replaces upstream's chat toggle when the tab is known.                                                                                                                                   |
| `src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx`                                                                 | `<AgentViewSubmenu>` replaces upstream's "Switch to chat/terminal view" item.                                                                                                                                                                  |
| `src/renderer/src/components/native-chat/use-native-chat-context-menu.tsx` (+ test), `NativeChatResolvedView.tsx`                | The optional `agentView` argument: a terminal-backed chat's right-click menu shows `<AgentViewSubmenu>` instead of "Switch to terminal view". Structured chats keep their menu.                                                                |
| `SortableTabContextMenu.test.tsx`, `SortableTab.rename-shortcut.test.tsx`, `register-core-handlers.test.ts`                      | Store fields / module mocks for the above; re-apply after taking upstream's test.                                                                                                                                                              |

### 19. Send a note in three key presses

Mod+Enter in a diff note composer (draft card or popover) saves the note and puts focus on the
saved card's "Send notes to an agent" button. Enter then opens the menu, whose first item, "Auto-picked",
is already highlighted, and a second Enter sends the note.

`note-send-focus.ts` arms for 5 s on Mod+Enter. `addDiffComment` claims the arm for the new note's id
before the store write. The card's `NotesSendMenu` (`focusRequestKey={comment.id}`) takes that claim
once and focuses its trigger on the next frame, after the composer's own focus handoff.

`pickAutoSendTarget` (`src/renderer/src/lib/auto-send-target.ts`) ranks the eligible targets of
any agent type:

- A session that is the active tab of a group in the worktree's layout beats one that is not.
- After that, the latest activity wins: the agent status `updatedAt`, falling back to the tab's `lastFocusedAt`.

When no target is eligible, the item does not show.

A note sent to a Claude Code terminal that is working would queue, and Remote Control never shows
queued messages. So after the note's Enter, Orca sends Claude Code's "send now" chord (Ctrl+X Ctrl+S,
the fallback for Ctrl+Enter): Claude reads the note mid-turn, or right after the reply it is writing.
Other agents keep their own queueing.

New files: `src/renderer/src/lib/auto-send-target.ts` (+ test),
`src/renderer/src/components/diff-comments/note-send-focus.ts` (+ test),
`src/renderer/src/components/editor/ReviewNotesSendMenuContent.auto-picked.test.tsx`,
`tests/e2e/note-send-keyboard.spec.ts`.

| File                                                                                                                              | What is ours                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/components/editor/ReviewNotesSendMenuContent.tsx` (+ test)                                                      | The `groupsByWorktree` / `layoutByWorktree` selectors, the `autoPicked` memo, and `AutoPickedMenuItem` rendered first; the test's store defaults and `sessionItems` helper. |
| `src/renderer/src/components/editor/NotesSendMenu.tsx` (+ test)                                                                   | The `focusRequestKey` prop, `triggerRef` and its focus effect; `useRef` in the test's fake React.                                                                           |
| `src/renderer/src/components/diff-comments/diff-comment-zone-card.tsx`                                                            | `focusRequestKey={comment.id}`.                                                                                                                                             |
| `src/renderer/src/components/diff-comments/DiffCommentDraftCard.tsx` (+ test), `DiffCommentPopover.tsx`                           | `armNoteSendFocus()` on the Mod+Enter submit.                                                                                                                               |
| `src/renderer/src/store/slices/diffComments.ts`                                                                                   | `noteCreatedForSendFocus(comment.id)` in `addDiffComment`.                                                                                                                  |
| `src/renderer/src/lib/active-agent-note-send.ts`, `active-agent-note-send-delivery.ts`, `active-agent-terminal-send-readiness.ts` | `sendNowWhenWorking` for a Claude pane, `agentWorking` on readiness, and `sendQueuedPromptNow`; new test `active-agent-note-send-send-now.test.ts`.                         |
| `src/renderer/src/i18n/locales/en.json`, `en-runtime-required.json`                                                               | The `autoPicked` key.                                                                                                                                                       |

### 20. Centre a diff's first change after layout

Upstream centres a newly opened diff on its first change one frame after the diff computes. A diff
swapped in from the file list can still be a few px tall then, so `top - height / 2` pinned the change
to the top. `useDiffViewerFirstChangeAutoScroll.ts` now waits for `onDidLayoutChange` when the
height is under 50 px and centres then. `tests/e2e/diff-first-change-centered.spec.ts` opens four
changed files in turn and checks each change sits mid-editor.

### 21. Agent notes

Agents leave notes on diff lines with `orca notes add --file --line [--end-line] --body [--agent]`
(also `notes list`, `notes rm`). They live in `WorktreeMeta.agentNotes`, apart from the user's
`diffComments`, because the renderer saves `diffComments` as a whole list and would drop a note
written by another process. A note is a `DiffComment` with `agentAuthor: { kind: 'agent', name }`.
The main-side RPC methods `agentNote.add` / `agentNote.list` / `agentNote.remove`
(`src/main/runtime/rpc/methods/agent-notes.ts`) serialize writes per worktree.

The diff (file and combined) renders them as normal note cards with the agent's own icon
(`AgentNoteIcon`: `agentFromNoteAuthor` matches the signed name to the agent catalog, else a bot),
agent name, a neutral "Agent note" badge, delete only, no edit and no send menu. The diff header has an
"Agent notes" pill listing the file's agent notes, and the Source Control sidebar has an "Agent
notes" shelf (stacked rows) plus a bot count on each changed-file row (`agent-note-file-badge.tsx`).
They never enter a send-to-agent prompt, since the send menus read `diffComments`.

Sending your notes no longer deletes them: `clearDeliveredDiffComments` (`store/slices/diffComments.ts`)
marks them `sentAt` instead, and `formatDiffCommentsForAgent` adds a "Note id:" line per note. The agent
answers with `orca notes reply --id <note id>` (`agentNote.reply`), an agent note with `replyToNoteId`
that copies the note's file and lines. `withAgentReplies` (`lib/agent-note-replies.ts`) puts each reply
inside its note's card (`agent-note-replies-list.tsx`, through `DiffCommentCard`'s `footer`); a reply
whose note is gone shows on its own. The shelf's clear-all also deletes the user notes that were replied to.

Every note is a thread (`buildNoteThreads` in `lib/agent-note-replies.ts`): its root, the user's or an
agent's, plus every note whose `replyToNoteId` is that root, oldest first, in `threadReplies`. The card's
`NoteThread` (`agent-note-replies-list.tsx`) lists them and has a Reply box that adds a user note with
`replyToNoteId`; the card's send menu sends the thread's unsent user notes, so an agent note gets one once
you ask a follow-up. A follow-up's prompt carries "Earlier in this thread" (`formatDiffCommentsForAgent`'s
`earlierInThread`, read from the store by `earlierInThreadFromStore`), and `agentNote.reply` on any note
in a thread, the agent's included, attaches to the root. Clear-all removes the whole threads.

`--github-comment <url>` stores `githubCommentUrl`; the card's reply button runs `revealGitHubComment`,
which opens the Checks tab and asks `pr-comment-reveal.ts` to scroll to and ring the `CommentRow`
whose `url` matches.

Prompts ask agents to leave these notes (`src/shared/agent-note-prompt.ts`): diff notes go out through
`formatDiffCommentsForAgent` (DiffNotesSendMenu, the per-note send), and the single PR thread prompt
(`InlinePRCommentCard`), the queued PR comments prompt (`pr-comments-resolution-prompt.ts`) and the default
Review templates (`workspace-action-prompts.ts`, `workspace-status-rule-config.ts`) carry the instruction,
with `--github-comment` for PR comments. A custom Review template in Settings does not get it.

New files: `src/shared/rpc-contract/agent-note-params.ts`, `src/main/runtime/rpc/methods/agent-notes.ts`
(+ test), `src/cli/specs/notes.ts`, `src/cli/handlers/notes.ts` (+ test), `src/renderer/src/lib/agent-notes.ts`,
`src/renderer/src/components/editor/AgentNotesPill.tsx`,
`src/renderer/src/components/right-sidebar/source-control/notes/agent-notes-shelf.tsx` (+ test),
`src/renderer/src/components/diff-comments/diff-comment-zone-card.agent-note.test.tsx`,
`tests/e2e/agent-notes.spec.ts`.

| File                                                                                               | What is ours                                                                                  |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/shared/diff-comment-types.ts`                                                                 | `DiffCommentAgentAuthor` and `agentAuthor`.                                                   |
| `src/shared/worktree/meta-types.ts`, `src/shared/worktree/types.ts`                                | `agentNotes`.                                                                                 |
| `src/main/ipc/worktree-metadata-merge.ts`                                                          | `agentNotes: meta?.agentNotes`.                                                               |
| `src/main/runtime/rpc/methods/index.ts`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts` | `AGENT_NOTE_METHODS`; regenerate the catalog.                                                 |
| `src/cli/specs/index.ts`, `src/cli/handler-group-manifest.ts`                                      | The `notes` specs and handler group.                                                          |
| `src/renderer/src/components/diff-comments/DiffCommentCard.tsx`, `diff-comment-zone-card.tsx`      | The `agentName` prop and its header; no edit/send for agent notes.                            |
| `src/renderer/src/components/editor/DiffViewer.tsx`, `DiffSectionItem.tsx`                         | `useFileAgentNotes` merged into the decorator's comments; delete routes to `removeAgentNote`. |
| `src/renderer/src/components/editor/EditorPanelHeader.tsx`                                         | `<AgentNotesPill>`.                                                                           |
| `src/renderer/src/components/right-sidebar/source-control/panel/panel-ready.tsx`                   | `<AgentNotesShelf>`.                                                                          |
| `src/renderer/src/assets/main.css`                                                                 | The agent badge and note-thread styles.                                                       |
| `skill-guides/orca-cli.md` (+ generated guides), `docs/site/content/docs/cli/reference.mdx`        | The Diff Notes / Diff notes sections.                                                         |

### 22. Outdated review threads stay in the diff

Upstream drops a review thread from the diff when GitHub marks it outdated, or its line is gone
or past the end. `inline-pr-comment-placement.ts` instead places it after the last line, sorted
below the anchored threads, with `outdated: true`. `useInlinePRCommentZones.tsx` gives it a high
zone `ordinal` so it sits below every other zone on that line, and `InlinePRCommentCard` shows
"Outdated · was on line N" above it. The placement test's outdated/past-end/no-line cases changed with it.

### 23. Open branch diffs follow a new diff base

A branch diff tab snapshots its compare when opened, so picking another base in the review shelf's
"What the diff compares against" select left the open file on the old one. `setGitBranchCompareResult`
(`git-branch-compare-actions.ts`) now runs `retargetBranchDiffFiles` (`git/retarget-branch-diff-files.ts`):
open branch and combined-branch diffs of that worktree take the new snapshot and a reload request,
keeping their tab id; a single-file diff whose file is not changed against the new base is left alone.
`openBranchDiff` (`open-history-diff.ts`) reuses such a tab by worktree, path and compare version.
Tests: `retarget-branch-diff-files.test.ts`, `editor-branch-diff-retarget.test.ts`.

### 24. Emoji shortcodes in comment boxes

Wherever the `@` member picker works, typing `:` and two or more characters opens an emoji list
(Slack/Linear style); Enter, Tab or a click inserts the emoji. It reuses the workspace-name emoji
catalog and ranking (`searchWorkspaceEmojiShortcodes`). New files in `src/renderer/src/components/github/`:
`emoji-shortcode-query.ts` (+ test), `emoji-shortcode-list.tsx`, `review-emoji-shortcode-extension.ts`;
plus `pull-request-page/mentions/textarea.emoji.test.tsx`.

| File                                                                  | What is ours                                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/components/github/ReviewMarkdownComposer.tsx`       | The `ReviewEmojiShortcode` extension, emoji query state, `insertEmoji`, the emoji branch of the key handler, `<EmojiShortcodeList>`.                   |
| `src/renderer/src/components/pull-request-page/mentions/textarea.tsx` | Emoji query state, `insertEmoji`, the emoji key handling and `<EmojiShortcodeList>` anchored to the textarea.                                          |
| `src/renderer/src/components/github/github-mention-autocomplete.tsx`  | `clampListLeft` (`autocomplete-list-position.ts`) on the list's `left`, so neither list runs off the right edge; test `emoji-shortcode-list.test.tsx`. |

### 25. Preview deployment button and a roomier right-panel header

Our PRs get a bot comment per push ("Preview deployment for `sha`: url"). `PreviewDeploymentButton.tsx`
sits next to the right sidebar toggle and opens the newest one; its tooltip names the commit, its age,
and whether it is behind the PR head. Parsing is `src/renderer/src/lib/preview-deployment.ts` (+ test).
It loads the active PR's comments itself (cached), again when the head moves and on hover.

To fit it and the other header buttons, `getTopActivityBarLayout` (`activity-bar-overflow.ts`) first
narrows the tab buttons (`compact`, 28px) before moving any behind More, and `showsHeaderActionLabels`
turns Review / Commit & push into icon buttons with tooltips below a 560px panel.

| File                                                                                     | What is ours                                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/renderer/src/components/right-sidebar/activity-bar-overflow.ts`                     | The `compact` step and `showsHeaderActionLabels`; the overflow tests now use 100px for "too tight". |
| `src/renderer/src/components/right-sidebar/activity-bar-buttons.tsx`                     | `compact` prop on `ActivityBarButton`.                                                              |
| `src/renderer/src/components/right-sidebar/right-sidebar-top-activity-bar.tsx`           | Passes `compact` through.                                                                           |
| `src/renderer/src/components/right-sidebar/workspace-actions/WorkspaceActionButtons.tsx` | `ActionButton` with the `showLabels` prop.                                                          |
| `src/renderer/src/components/right-sidebar/index.tsx`                                    | Renders `PreviewDeploymentButton` and passes `showLabels`.                                          |

### 26. Language servers: a registry of languages and servers

**The registry.** `src/shared/language-server.ts` (`LANGUAGE_SERVERS`) is the one list of languages:
each has a material-icon logo, its Monaco language ids, its file extensions with the LSP language id
each opens as, and the servers it can run (`servers`, each a name, command, args and homepage) with
a `defaultServer`. Python offers pyrefly, Pyright, basedpyright and ty; TypeScript offers tsgo and
typescript-language-server. Two tables keyed by that list add the rest, so a new language fails
typecheck until it has both: main's `language-server-launchers.ts` (where a language's project
root and tools are — Python's venv `bin/`, TypeScript's `node_modules/.bin` dirs — plus env such as
`VIRTUAL_ENV`) and the renderer's `language-server-languages.ts` (settings label and description,
and an optional fallback; TypeScript's is the built-in worker). The chosen server is found in the
project's tool dirs, else on `PATH`, unless a custom path is set (`~/` expanded). Settings per
language (`languageServers` in `GlobalSettings`, read by `languageServerSettings`, which still
accepts the first version's plain on/off) are `{ enabled, server, command }`; any change stops that
language's running servers. Everything that used to name a language — the file check, the LSP
language id, the editor providers, the settings rows, the failure toast — reads the registry.

**Settings → Language Servers** is its own section (`LanguageServersPane.tsx`,
`language-servers-search.ts`, `renderLanguageServersSettingsSection`): one card per registry
language with its logo, an on/off switch, a segmented choice of its servers with a docs link, and a
path field saved on blur or Enter.

**One file per model.** Monaco models are named by whoever creates them: a tab by its path, a diff
side by an internal diff path, a Peek copy by `orca-definition:`. Each registers the worktree file
it shows in `lib/editor-model-files.ts` (`trackModelFile`, `trackDiffEditorFile`), and
`fileSource` (`language-server-file-source.ts`) resolves every kind the same way, so hover,
Cmd+click and references behave alike in a tab, a diff and a Peek preview, and git blame reads the
same registry.

Cmd+click jumps to the definition and hover shows types in local Python and TypeScript/JavaScript
files: same file, another file of the worktree, or installed packages. Main runs one language server
per project in `src/main/language-server/`: framing (`lsp-message-framing.ts`), the session
(`lsp-session.ts`, which opens each file with its own language id), a pool that stops a server after
15 idle minutes and keeps at most 4 (`lsp-session-pool.ts`), `language-server-service.ts` (picks the
server per request `language`, `stopLanguage`) and the spawn (`language-server-process.ts`, which
sets `VIRTUAL_ENV` for a venv).

- **Python:** `pyrefly lsp` for the nearest `pyrefly.toml`/`pyproject.toml`
  (`python-project-resolution.ts`). pyrefly comes from the venv's `bin/`, else `PATH`. The venv is
  the repo's `pythonVenvPath` setting (Settings → project → Python Environment; relative to the
  worktree or absolute), else the nearest `.venv`/`venv`. A worktree without one borrows the main
  checkout's venv at the same relative path (`repoRoot` in the request); a relative setting falls
  back there too. `.pyi` stubs open as `python` (`language-detect.ts`). A file outside the
  worktree and main checkout (pyrefly's bundled typeshed in a temp dir) goes to the server that
  worktree last used for that language, which has the right venv.
- **TypeScript/JavaScript:** `tsgo --lsp --stdio` (`@typescript/native-preview`) for the nearest
  `tsconfig.json`/`jsconfig.json` (`typescript-project-resolution.ts`), from the nearest
  `node_modules/.bin/tsgo`, then the main checkout's, then `PATH`. `bun check` was considered: it
  is a CLI type checker with no language server, so it can't answer definitions or hovers.

Turning a language off, or changing its server or path, stops its servers (`languageServer:stop`).
Monaco's own TS hover/definition are turned off once at startup — this Monaco reads
`modeConfiguration` only when the TS mode is first set up — and the providers call the built-in TS
worker themselves (`built-in-typescript-fallback.ts`) when tsgo is off, can't answer, or the file
is remote. When a server can't run, one toast per error says so instead of failing silently. Remote
(SSH/runtime) worktrees never start a server.

The renderer registers definition, hover and reference providers for every registry language's
Monaco ids (`lib/monaco-language-server-providers.ts`) plus an editor opener that opens a jump into
another file as an Orca tab (`lib/monaco-language-servers.ts`, logic and tests in
`lib/language-server-editor.ts`), installed from `monaco-setup.ts`. IPC: `languageServer:definition|hover|stop` (`ipc/language-server.ts`,
`preload/api/language-server-bridge.ts`, `languageServer` in `api-types.ts`).
Diff editors name their models with internal diff paths, so `DiffViewer.tsx` and
`DiffSectionItem.tsx` record each side's file with `trackDiffEditorFile`
(`lib/editor-model-files.ts`); Cmd+click in either side of a diff then works too, and a
same-file hit stays in the diff. From a diff, a target file that has its own changes
(`targetHasDiff`) opens in its diff via `openDiffAtLocation`, which prefers the uncommitted diff
(the newest version) over the branch diff; an unchanged target opens in a normal tab.
Hover content handles all three LSP shapes (`readHoverMarkdown`); pyrefly's "Go to …" links are
`file://…#Lline,col` and route through the same editor opener.

Holding Cmd over a name underlines it and previews the target. Standalone Monaco only underlines
when it already holds the target's model (`StandaloneTextModelService` rejects others with "Model
not found"), so main sends the target's first 10 lines with each definition (`preview`, read in
`ipc/language-server.ts`) and the renderer keeps `orca-definition:` plaintext models of them, the
lines placed at their own line number (`previewModelText`); the opener maps that scheme back to the
file. A file that is open is used as it is.

**Find references** (context menu Go to References / Peek References, Shift+F12, or Cmd+click on a
declaration, which Monaco turns into references because the definition is "already here"): main
asks the server for `textDocument/references` (declaration included) and sends the text of every
other referenced file (up to 50); the renderer shows them in Monaco's peek through whole-file
`orca-definition:` models with the file's language (`lib/language-server-preview-models.ts`, up to
80 copies; a definition snippet never overwrites a whole copy). Opening a reference from the peek
goes through the same opener, so it replaces the tab and lands in the history. Monaco's own TS
references are switched off with the hover and definition; `builtInTypeScriptReferences` answers
for open files when tsgo is off.

A jump replaces the tab it started in instead of adding one (`replaceableTabId`): not when that
tab has unsaved changes, already shows something else (the all-changes view), or the target has its
own tab. Every jump, same-file ones too, is recorded in a back/forward history
(`lib/code-navigation-history.ts`, 50 places, with the cursor's spot when leaving; opening and the
store in `lib/code-navigation.ts`). The titlebar's Back/Forward buttons, their shortcuts
(`worktree.history.back|forward`) and the mouse's back/forward buttons walk this history instead of
the worktree history. Mice that don't send buttons 3/4 to the page are caught in main
(`window/main-window-navigation-gestures.ts`): Logi Options+ on macOS sends a navigation `swipe`
(left = back), Windows/Linux an `app-command`; both go out as `ui:worktreeHistoryNavigate`.
The file editor's `smoothScrolling` is off, so a reveal is instant.

| File                                                                                                                                                                                               | What is ours                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/shared/repo-types.ts`, `ipc/repos/repo-update-handler.ts`, `repo-update-operations.ts`, `repo-lifecycle-operations.ts`, `store/repos/repo-state.ts`                                           | `pythonVenvPath` (trimmed, non-strings dropped).                                      |
| `src/renderer/src/components/settings/RepositoryPane.tsx`, `repository-git-worktree-search-entries.ts`                                                                                             | The Python Environment section (`PythonEnvironmentSection.tsx`) and its search entry. |
| `src/shared/global-settings-types.ts`                                                                                                                                                              | `languageServers`.                                                                    |
| `src/renderer/src/lib/settings-navigation-types.ts`, `hooks/settings-navigation-workflow-sections.ts`, `components/settings/settings-git-task-section-renderers.tsx`, `settings-page-renderer.tsx` | The `language-servers` section.                                                       |
| `src/renderer/src/lib/material-icons/material-icon.tsx`                                                                                                                                            | `MaterialNamedIcon` for the language logos.                                           |
| `src/main/ipc/register-core-handlers/register-core-handlers.ts` (+ test mock)                                                                                                                      | `registerLanguageServerHandlers()`.                                                   |
| `src/preload/index.ts`, `src/preload/api-types.ts`                                                                                                                                                 | `languageServer` API.                                                                 |
| `src/renderer/src/app-shell/TitlebarLeftControls.tsx`, `app-command-handlers.ts`, `hooks/ipc-events/workspace-shortcut-ipc-bridge.ts`                                                              | Back/Forward call `goInCodeHistory` instead of `goBackWorktree`/`goForwardWorktree`.  |
| `src/renderer/src/components/editor/MonacoEditor.tsx`                                                                                                                                              | `smoothScrolling: false`.                                                             |
| `src/main/window/main-window-state-lifecycle.ts`                                                                                                                                                   | `installMainWindowNavigationGestures(mainWindow)`.                                    |

### 27. Git Blame for the cursor's line

Like VS Code's Git Blame extension (Sertion/vscode-gitblame): the focused file editor shows faded
text after the cursor's line — "Author, 2 days ago • summary", "You" for your own commits, or "You •
Uncommitted change" — and hovering it shows the author, date, summary, the GitHub pull request and
commit as links, plus Show commit (Orca's commit diff) and Copy hash.

Main blames one line with `git blame --porcelain -L n,n --contents -`, feeding the editor's
current text so unsaved edits count, and compares the author email with `git config user.email`
(`git-blame/git-blame-service.ts`, IPC `gitBlame:line|links` in `ipc/git-blame.ts`,
`preload/api/git-blame-bridge.ts`). The pull request comes from a squash merge's "(#N)" suffix
when there is one, else from GitHub's `commits/{sha}/pulls` via `gh` (cached per commit, the merged
one first). GitHub's `commits/{sha}` gives the author's avatar (shown in the card) and login; a
commit also counts as "You" when that login is `gh`'s own (`user`), since squash merges carry your
GitHub email, not necessarily the checkout's `user.email`. Tailwind's base makes images blocks, so
`main.css` puts hover images back inline. The renderer (`lib/monaco-git-blame.ts`, text in `lib/git-blame-text.ts`) blames 250ms
after the cursor changes line or the text changes, only in focused local editors: file editors and
the modified side of a diff (`isModifiedDiffSide` in `diff-editor-model-files.ts`), not the
original side, remote worktrees or files over 16,384 lines. The gap before the text is non-breaking spaces,
not a CSS margin, because Monaco splits long injected text into several spans. The text never wraps
or scrolls the line sideways: it is cut with "…" to the room between the line's end and the editor's
right edge (`fitInlineText`, measured again on layout changes), and hidden when under 12 characters
fit. Settings → General →
Editor → **Git Blame** has "Show line blame" and "Show "You" for my commits" (`GitBlameSetting.tsx`,
`gitBlame` in `GlobalSettings`, read as on unless `false`).

| File                                                                                                | What is ours                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/global-settings-types.ts`                                                               | `gitBlame`.                                                                                                                                               |
| `src/renderer/src/components/settings/GeneralEditorSettingsSection.tsx`, `general-editor-search.ts` | `GitBlameSetting` and its search entry.                                                                                                                   |
| `src/main/ipc/register-core-handlers/register-core-handlers.ts` (+ test mock)                       | `registerGitBlameHandlers()`.                                                                                                                             |
| `src/preload/index.ts`, `src/preload/api-types.ts`                                                  | `gitBlame` API.                                                                                                                                           |
| `src/renderer/src/lib/monaco-setup.ts`                                                              | The `git blame` setup step.                                                                                                                               |
| `src/renderer/src/assets/main.css`                                                                  | `.orca-git-blame-inline`.                                                                                                                                 |
| `src/renderer/src/components/editor/useDiffViewerFirstChangeAutoScroll.ts` (+ test)                 | A pending reveal (a definition jump into a diff) is latched before the editor exists, so a slow diff no longer scrolls the jump back to its first change. |
| `src/renderer/src/components/editor/MonacoEditor.tsx`, `DiffViewer.tsx`, `DiffSectionBody.tsx`      | `fixedOverflowWidgets: true`, so hovers near the right edge aren't clipped by the editor.                                                                 |

A jump that replaces its tab closes it with `closeTabKeepingReveal` (`lib/close-tab-keeping-reveal.ts`):
`closeFile` clears the pending reveal, which a diff target has not applied yet, so the diff opened
at its first change (an import) instead of the definition.

### 28. Material Icon Theme file and folder icons

Files and folders use the [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
(`material-icon-theme` on npm, MIT) everywhere `getFileTypeIcon` is used — tabs, explorer, source
control, the combined diff's file tree, quick open, search — plus each diff section header, and
named folder icons (open and closed) in the explorer, source control and diff trees
(`MaterialFolderIcon`). `getFileTypeIcon` now returns one cached component per path that renders the
Material SVG; upstream's Lucide table is kept as `getLucideFileTypeIcon` (its upstream test points
there), and the simulator tab keeps its phone icon. The library's `generateManifest(config)` builds
the name/extension → icon map (`lib/material-icons/material-icon-store.ts`), matched like VS Code:
whole file name, then the longest extension (`material-icon-resolve.ts`), with light-theme
variants when the root lacks the `dark` class. The 1,251 SVGs are emitted as separate assets
(`import.meta.glob(..., { query: '?no-inline' })`), not inlined.

Users configure it like the VS Code extension in `~/.orca/material-icon-theme.json`, either with the
extension's settings.json keys (`"material-icon-theme.files.associations"`, `folders.associations`,
`languages.associations`, `folders.theme`, `activeIconPack`) or the same settings nested
(`shared/material-icon-config.ts`). Main reads and watches the file (`ipc/material-icons.ts`, the
folder is watched because editors save by replacing the file) and broadcasts
`materialIcons:changed`; the renderer regenerates the manifest on every save and toasts invalid
entries once (`material-icon-config-sync.ts`, started in `main.tsx`). Settings → General → Editor →
**File Icons** → Edit icon settings creates the file and opens it in the floating workspace, like
`keybindings.json`. The extension's color, opacity and saturation settings aren't supported: the
extension applies them by rewriting SVG files.

| File                                                                                                                                                                                   | What is ours                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/renderer/src/lib/file-type-icons.ts` (+ upstream test import)                                                                                                                     | `getFileTypeIcon` returns Material icons; the Lucide version is `getLucideFileTypeIcon`. |
| `src/renderer/src/components/right-sidebar/FileExplorerRow.tsx`, `source-control/listing/tree-directory-rows.tsx`, `editor/combined-diff/browse-files/combined-diff-file-tree-row.tsx` | `MaterialFolderIcon` instead of Lucide `Folder`/`FolderOpen`; explorer icons at 16px.    |
| `src/renderer/src/components/editor/DiffSectionHeader.tsx`                                                                                                                             | The file's icon before its path.                                                         |
| `src/renderer/src/main.tsx`                                                                                                                                                            | `startMaterialIconConfigSync()`.                                                         |
| `src/main/ipc/register-core-handlers/register-core-handlers.ts` (+ test mock)                                                                                                          | `registerMaterialIconHandlers()`.                                                        |
| `src/preload/index.ts`, `src/preload/api-types.ts`                                                                                                                                     | `materialIcons` API.                                                                     |
| `src/renderer/src/components/settings/GeneralEditorSettingsSection.tsx`, `general-editor-search.ts`                                                                                    | `FileIconsSetting` and its search entry.                                                 |
| `package.json`, `pnpm-lock.yaml`                                                                                                                                                       | `material-icon-theme` 5.39.0.                                                            |

### 29. The right sidebar follows the active file's kind

However a tab becomes active (a click, Cmd+click, the next-changed-file hotkey, the command menu,
history), the right sidebar shows source control for a diff (a diff or conflict-review tab, or a
file in its changes view) and the explorer's files for a plain file
(`lib/right-sidebar-follows-file.ts`, installed in `main.tsx`). It switches only when the kind
changes, so a panel the user picks stays while they move between diffs or between files.
Terminals, browsers and other tabs change nothing. It switches the tab without opening a closed
sidebar.

| File                        | What is ours                        |
| --------------------------- | ----------------------------------- |
| `src/renderer/src/main.tsx` | `installRightSidebarFollowsFile()`. |

### 30. Quick Open: filename-first ranking, `%` text search, `:` go to line

Quick Open ranks by how the filename matches the query's last segment before recency: exact
name, then name prefix, then name substring, then name fuzzy, then path-only matches. Inside each
level, files in dependency folders (`node_modules`, `.venv`, `site-packages`, …) go after project
files (`quick-open-history-ranking.ts`). A query starting with `%` searches file contents through
the project search (`searchRuntimeFiles`) and lists matches grouped by file. `:line[:col]` jumps
in the active editor file. `file:line` already worked upstream (`quick-open-modes.ts`,
`use-quick-open-text-search.ts`, `QuickOpenModeItems.tsx`).

| File                                                        | What is ours                                            |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| `src/renderer/src/components/QuickOpen.tsx`                 | Text and go-to-line modes, `openPath`, the placeholder. |
| `src/renderer/src/components/quick-open-history-ranking.ts` | Filename tiers and dependency-folder demotion.          |
| `src/renderer/src/i18n/locales/en.json`                     | `quickOpen.*` mode strings.                             |

A trailing `:` (`base.py:`, `file:12:`) is a line number still being typed, so the parser drops
it instead of searching for a literal colon (`src/shared/quick-open-query-target.ts`; upstream kept
`file:1:` literal).

### 31. Agent turn snapshots

Every agent turn in a local git worktree gets its own diff, independent of what was committed or
staged. Orca's hook listener (`main-window-agent-status.ts`) feeds `agent-turns/agent-turn-recorder.ts`:
a new `turnStartedAt` snapshots the worktree, and `done` snapshots it again
(`agent-turn-tracker.ts`). A turn lasts until the agent stops for good: a prompt sent while it
works stays in the turn, and a wake-up after a stop (a background agent finishing fires
`UserPromptSubmit` but keeps the user's latest prompt) resumes it, so the turn is recorded again
from its first snapshot and replaces the part recorded at the earlier stop (`replaces`). A snapshot is `git add -A` into a copy of the index under
`GIT_INDEX_FILE`, so untracked files are captured, ignored files are not, and the real index is
never touched. The end snapshot is a commit whose parent is the start snapshot. Its message holds
the turn as JSON (prompt, agent, pane, times, stats), and it is kept under
`refs/worktree/orca-turns/<completedAt>-<oid>`. Turns that changed nothing are skipped, and only the
newest 50 are kept per worktree (`agent-turn-snapshots.ts`). Because a turn is an ordinary commit,
source control's "Agent turns" section opens it through `git.commitCompare` and
`openCommitAllDiffs`, the same view a commit uses
(`right-sidebar/source-control/agent-turns/`). SSH and folder workspaces are skipped. Two agents in
one worktree, or your own edits during a turn, land in that turn's diff.

| File                                                                               | What is ours                            |
| ---------------------------------------------------------------------------------- | --------------------------------------- |
| `src/main/startup/main-window-agent-status.ts`                                     | `observeAgentTurn(...)` per hook event. |
| `src/main/ipc/register-core-handlers/register-core-handlers.ts`                    | `registerAgentTurnHandlers()`.          |
| `src/preload/index.ts`, `src/preload/api-types.ts`                                 | `agentTurns` bridge.                    |
| `src/renderer/src/components/right-sidebar/source-control/panel/panel-content.tsx` | `AgentTurnsSection`.                    |
| `src/renderer/src/i18n/locales/en.json`                                            | `agentTurns.title`.                     |

### 32. Resizable, uniform source-control sections

The pending-review and agent-notes sections and the changed-file list share one vertical
`react-resizable-panels` group (shadcn's `components/ui/resizable.tsx`, v4 API), with a drag
handle between each (`panel/resizable-sections.tsx`). A section's max size is its content height,
so a collapsed one stays at its header. When its content grows (expand) it opens to the height
the user last dragged it to, kept per section in `localStorage`, or until then to its content up
to half the panel. A section the user dragged smaller than its content keeps that height
(`panel/shelf-sizing.ts`). The sections' fixed `max-h-64` caps are gone. Agent notes and agent
turns use the shared `SectionHeader`, so every section has the same heading, chevron, count and
actions row. That header (`listing/section-header.tsx`) is the Commits header's 28px row (border,
spacing, 11px uppercase label, 10px count) and is `sticky top-0` within its section. A long section
keeps its title and actions in view until the next one pushes it out.

Your own notes have no section here: upstream's Notes shelf (`notes/notes-shelf.tsx`) and the
overflow menu's "Notes" item are removed, and notes stay in the diff viewer. The "send review
notes" shortcut no longer reveals source control. The diff viewer's notes menus answer it instead
(`EditorPanelHeader.tsx`, `combined-diff-toolbar.tsx`, `ui-slice-agent-actions.ts`).

| File                                                                                                            | What is ours                                                        |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `package.json`                                                                                                  | `react-resizable-panels` 4.13.3.                                    |
| `src/renderer/src/components/right-sidebar/source-control/panel/panel-ready.tsx`                                | Shelves passed to `SourceControlResizableSections`; no Notes shelf. |
| `src/renderer/src/components/right-sidebar/source-control/panel/header-toolbar.tsx`, `header-overflow-menu.tsx` | No Notes item.                                                      |
| `src/renderer/src/components/right-sidebar/source-control/notes/agent-notes-shelf.tsx`                          | `SectionHeader` header, no list cap.                                |
| `src/renderer/src/components/right-sidebar/source-control/pending-review/pending-review-shelf.tsx`              | No list cap or border.                                              |

### 33. Latest-turn shortcut and horizontal trackpad scroll in combined diffs

`sourceControl.openLatestAgentTurn` (Cmd+Option+Shift+T on macOS, unbound elsewhere because
Ctrl+Alt is AltGr) opens the active workspace's newest agent turn in the commit diff view, or turns
that filter off when it is already showing (`lib/agent-turn-open.ts`, shared with the Agent turns section; handled in
`app-shell/source-control-shortcuts.ts`, which also holds upstream's send-notes block moved out of
`use-global-keybindings.ts` to keep it under the line limit). Combined-diff sections turn off Monaco's wheel handling so vertical
scrolling reaches the outer list, and upstream re-added only Shift+wheel for sideways scrolling. A
mostly horizontal trackpad swipe now scrolls the pane too (`diff-editor-shift-wheel-scroll.ts`).

| File                                                                   | What is ours                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/shared/keybindings/definitions-core-4.ts`, `types.ts`             | `sourceControl.openLatestAgentTurn`.                                         |
| `src/renderer/src/app-shell/use-global-keybindings.ts`                 | One `takeSourceControlShortcut(...)` call for both source-control shortcuts. |
| `src/renderer/src/components/editor/diff-editor-shift-wheel-scroll.ts` | Horizontal swipes without Shift.                                             |
| `src/renderer/src/i18n/locales/en.json`                                | `agentTurns.none`.                                                           |

### 34. Cmd+click inside a Peek preview

Peek shows a reference in a file with no tab as a whole-file `orca-definition:` copy, which
registers the worktree file it came from (see "One file per model" in 26), so hover, underline and
Cmd+click go to the language's server like an open file. A jump from the copy always opens the real
file in a tab instead of moving inside the preview (`isWholeFileCopy` in the opener).

### 35. One list of every changed file, live against the base

By default (`sourceControlGrouping`, unset = `'all'`) source control shows one **Changes** section
in place of upstream's staged / changes / untracked / committed-on-branch sections. It lists every
file that differs from the branch base, committed or not, once (`listing/all-changes.ts`,
`use-all-changes-projection.ts`, `all-changes-section.tsx`). Its rows are keyed
`branch-worktree::<path>`. A file with both a committed and an uncommitted change shows no line
count, because per-area counts overlap. The overflow menu's "Group by status" brings back
upstream's sections, and that choice is saved.

A row opens a `branch-worktree` diff (`actions/open-branch-worktree-diff.ts`): the base side is read
at the merge base through the branch diff, and the other side is the file on disk through the
working-tree diff (`editor/branch-worktree-diff.ts`). The tab is treated like an unstaged diff:
read-only (§58), reloaded by the file watcher and on every status change. A new compare (a
commit, a new base) retargets it (`retarget-branch-diff-files.ts`). A conflicted file opens its
resolver instead, and with no base yet the row falls back to the uncommitted diff. Any tab of a path
highlights its one row, and file stepping walks these rows (`ChangedFileArea` `'branch-worktree'`,
`openDiffAtLocation`). "View all" opens upstream's All Changes combined diff.

The file-type filter is an icon popout in the Changes header, beside View all
(`SourceControlFileCategoryFilter`'s `compact`). The section stays up while a type filter empties it,
so the filter can be reached. Keyboard file stepping keeps the row clear of the sticky section
header (`scroll-pt-7` on the scroller) and of the docked Commits footer, whose live height becomes
the scroller's bottom scroll-padding (`panel/dock-scroll-padding.ts`).

Upstream's commit box is gone; committing is left to the agent or the CLI. `commit-surface.tsx`
renders only the Create review composer when that is the next step. `commit/commit-area.tsx` is
left in place, unused, to keep upstream merges clean. The two `SourceControl.preview-open` tests of
its Stage All button are removed.

| File                                                                                                                                                                | What is ours                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/global-settings-types.ts`                                                                                                                               | `sourceControlGrouping?`.                                                                                                                      |
| `src/renderer/src/store/slices/editor/types/open-file.ts`, `editor-files-slice.ts`, `create-editor-slice.ts`                                                        | `'branch-worktree'` diff source and `openBranchWorktreeDiff`.                                                                                  |
| `src/renderer/src/store/slices/editor/actions/changed-file-order.ts`, `open-diff-at-location.ts`                                                                    | The `'branch-worktree'` area.                                                                                                                  |
| `src/renderer/src/components/editor/useEditorPanelDiffContentLoader.ts`                                                                                             | The `branch-worktree` read.                                                                                                                    |
| `editor-autosave.ts`, `editor-panel-diff-reload.ts`, `editor-external-watch-path-index.ts`, `EditorDiffFileSurface.tsx`                                             | `'branch-worktree'` next to `'unstaged'`.                                                                                                      |
| `source-control/listing/use-file-listing.ts`, `use-row-opening.ts`, `use-published-review-order.ts`                                                                 | The projection, opener, highlight and review order. Upstream's open-in path block moved to `use-open-in-selection-path.ts` for the line limit. |
| `source-control/listing/tree-directory-rows.tsx`                                                                                                                    | The branch directory row takes only the header fields.                                                                                         |
| `source-control/panel/use-panel-view-state.ts`, `use-panel-foundation.ts`, `panel-ready.tsx`, `header-toolbar.tsx`, `header-overflow-menu.tsx`, `panel-content.tsx` | The grouping toggle, the section, and the bottom dock.                                                                                         |
| `source-control/listing/file-category-filter.tsx`                                                                                                                   | The `compact` popout.                                                                                                                          |
| `source-control/panel/commit-surface.tsx`                                                                                                                           | No commit box.                                                                                                                                 |
| `SourceControl.open-file-highlight.test.tsx`, `SourceControl.preview-open.test.tsx`, `SourceControl.virtual-file-list.test.tsx`                                     | `sourceControlGrouping: 'status'`, since they cover upstream's sections; the commit-box tests removed.                                         |
| `src/renderer/src/i18n/locales/en.json`                                                                                                                             | `allChanges.*`.                                                                                                                                |

### 36. Source-control sections: one Review section, dragged order, hidden sections

Review, Agent notes, Agent turns, Changes and Commits are sections listed in
`src/shared/source-control-sections.ts`. Review (id `pending-review`) is one section for the
reviewers, your drafts, the diff-base picker and the verdict form
(`pending-review-shelf.tsx`). Its `SectionHeader` collapses all of it and always shows, and the
drafts list is a small disclosure inside it. Review is a full-height shelf (`fullHeightByDefault`,
`preferredShelfHeight` in `shelf-sizing.ts`). Until the user drags it, it opens to all of its
content and grows with it, as when the summary box grows; other shelves stop at half the panel.
Agent turns is a resizable shelf like the others (`panel-ready.tsx`); it takes its turns as a prop
(`useAgentTurns`).

Every section but Commits, which stays docked under the files, sits in the resizable group in the
user's order (`resizable-sections.tsx`). Dragging a section's header onto another moves it before
or after it, depending on which half it lands on (`listing/section-chrome.tsx`,
`panel/section-drop-zone.tsx`). Right-clicking a header, or the Commits dock, offers Hide section.
View > Source Control Sections has a visibility checkbox for each
(`main/menu/source-control-sections-menu.ts`). Both are saved in `sourceControlSectionLayout`
(`{ order, hidden }`). Saving it rebuilds the menu, which reads the labels' English fallbacks.

| File                                                        | What is ours                                                                                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/global-settings-types.ts`                       | `GlobalSettings` extends `ForkBaseSettings` (`shared/fork-source-control-settings.ts`: `sourceControlGrouping`, `sourceControlSectionLayout`), kept out of this file for its line limit. |
| `src/main/menu/register-app-menu.ts`                        | The optional `getPanelSectionSubmenus`, appended after Appearance.                                                                                                                       |
| `src/main/startup/main-process-i18n-menu.ts`                | Its implementation (`buildPanelSectionsSubmenus`).                                                                                                                                       |
| `src/main/ipc/settings.ts`                                  | `sourceControlSectionLayout` in `APPEARANCE_MENU_KEYS`.                                                                                                                                  |
| `source-control/listing/section-header.tsx`                 | Optional `count`; the header wrapped in its section's chrome.                                                                                                                            |
| `source-control/panel/resizable-sections.tsx`               | Ordered sections with drop zones; handles between panels, not after each shelf.                                                                                                          |
| `source-control/panel/panel-ready.tsx`, `panel-content.tsx` | The order, hiding, the Agent turns shelf.                                                                                                                                                |
| `source-control/pending-review/pending-review-shelf.tsx`    | The Review header, `collapsed` / `onToggle`, the drafts disclosure.                                                                                                                      |
| `src/renderer/src/i18n/locales/en.json`                     | `menu.sourceControlSections`, `sourceControlSections.hide`, `sourceControlSections.review`.                                                                                              |

### 37. PR panel sections

The PR panel gets the same treatment as source control (§36). The review header (number, title,
merge actions) stays fixed. Under it, Needs attention (the failing-check / conflict triage strip
and conflict files, `checks-panel/attention-section.tsx`), Checks, Pending review and Comments are
sections listed in `PR_PANEL_SECTIONS`. Each is headed by the same `SectionHeader`, so it collapses,
drags to reorder and hides from its right-click menu or from View > PR Panel Sections
(`checks-panel/pr-panel-sections.tsx`, reusing `SectionDropZone`, which only takes drops from its
own panel's sections). The layout is saved under `sourceControlSectionLayout.pr`. Checks keeps its
passing / failing / pending chips as header actions, and Comments keeps its actions there.
Pending review shows only with drafts.

| File                                                                       | What is ours                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `checks-panel/active-content.tsx`                                          | The sections, built into `PrPanelSections`.                                                                |
| `checks-panel/checks-list.tsx`, `use-checks-list-state.tsx`                | The opt-in `sectionHeader` (the folder-workspace row keeps the old summary).                               |
| `checks-panel/comments-list.tsx`, `use-comments-list-state.tsx`            | The opt-in `sectionHeader`; the actions lifted into `headerActions`; pending review left out in that mode. |
| `src/renderer/src/components/pending-review/PendingReviewPanelSection.tsx` | The opt-in `sectionHeader`.                                                                                |
| `src/renderer/src/i18n/locales/en.json`                                    | `menu.prPanelSections`, `prPanelSections.*`.                                                               |

### 38. Only uncommitted changes (⌥⌘U)

`sourceControl.toggleUncommittedOnly` (⌥⌘U, macOS only like Open Latest Agent Turn, since
Ctrl+Alt+letter is AltGr text on Windows and Linux) narrows the Changes list (§35) of the active
workspace to files with staged, unstaged or untracked changes. Rows still read against the base.
While it is on, an Uncommitted badge sits beside the file type filter; its × shows every change
again. The flag is per workspace and kept outside the panel
(`lib/changes-filter.ts`, see §46), so the shortcut works while the panel is closed. It is not
saved across restarts.

| File                                                                          | What is ours                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/shared/keybindings/definitions-core-4.ts`, `types.ts`                    | The action and its default chord.                            |
| `src/renderer/src/app-shell/source-control-shortcuts.ts`                      | Toggling the active workspace's flag.                        |
| `source-control/listing/all-changes.ts`                                       | `buildAllChangeEntries`' `uncommittedOnly` option.           |
| `source-control/listing/use-all-changes-projection.ts`, `use-file-listing.ts` | Reading the flag.                                            |
| `source-control/listing/all-changes-section.tsx`, `panel/panel-content.tsx`   | The badge; the section stays up while the filter empties it. |
| `src/renderer/src/i18n/locales/en.json`                                       | `allChanges.uncommittedOnly`, `allChanges.showAllChanges`.   |

### 39. Send queued comments from anywhere (⌥⌘S)

While PR comments are queued for an agent, the status bar shows "N queued"
(`status-bar/QueuedCommentsStatusSegment.tsx`), whichever panel is open. Clicking it, or
`sourceControl.sendQueuedComments` (⌥⌘S, macOS only), opens the PR panel and leaves it a send
request (`right-sidebar/queued-pr-comments-send.ts`). The panel runs its usual send once its
comments have loaded (`checks-panel/use-pr-comment-queue-panel.ts`), because the send dialog and
its acknowledgement live there and the panel is unmounted on other tabs. The count reads the same
queue the inline cards and the Comments list write.

| File                                                       | What is ours                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/shared/keybindings/definitions-core-4.ts`, `types.ts` | The action and its default chord.                                   |
| `src/renderer/src/app-shell/source-control-shortcuts.ts`   | Sending from the shortcut.                                          |
| `right-sidebar/pr-comment-queue-context.ts`                | `readPRCommentQueueContextKey`, `subscribePRCommentQueue` exported. |
| `checks-panel/active-content.tsx`                          | The queue context publish moved into `usePRCommentQueuePanel`.      |
| `status-bar/StatusBarSurface.tsx`                          | The segment, first among the attention segments.                    |
| `src/renderer/src/i18n/locales/en.json`                    | `queuedComments.*`.                                                 |

### 40. Resolved comments as their own PR panel section

Resolved threads leave the Comments section for a Resolved section (`pr-resolved` in
`PR_PANEL_SECTIONS`) under the shared section header, so it collapses, drags and hides like the
others (§37). It opens closed, like the accordion it replaces, and lists every resolved thread
whatever the Comments audience filter (`checks-panel/resolved-comments-section.tsx`). Outside the
PR panel, `PRCommentsList` keeps the accordion.

| File                                    | What is ours                                                        |
| --------------------------------------- | ------------------------------------------------------------------- |
| `checks-panel/comment-sections.tsx`     | The Comments and Resolved sections, built for `active-content.tsx`. |
| `checks-panel/comments-list.tsx`        | No resolved accordion in section mode.                              |
| `src/shared/source-control-sections.ts` | `pr-resolved`.                                                      |
| `src/renderer/src/i18n/locales/en.json` | `prPanelSections.resolved`.                                         |

### 41. The new-comment box opens a gap instead of covering code

The diff viewer's Agent / Comment / Review box stays an overlay, but an empty Monaco view zone
as tall as the box opens under its line (`diff-comments/diff-comment-popover-spacer.ts`), so the
lines and saved comment cards below move down rather than sit under it. The zone has `ordinal: 0`
so it sorts ahead of saved comment zones on the same line, right where the box draws. The box no
longer flips above its line near the bottom, since that would cover the code above.

| File                                             | What is ours                                          |
| ------------------------------------------------ | ----------------------------------------------------- |
| `diff-comments/DiffLineCommentPopoverHost.tsx`   | The spacer, sized from the box.                       |
| `diff-comments/DiffCommentPopover.tsx`           | `onHeightChange`; inline placement when it is passed. |
| `diff-comments/diff-comment-popover-position.ts` | The `inline` option.                                  |

### 42. Who reacted, on hover

The review threads query asks each reaction group for its first 3 reactors' logins
(`reactors(first: 3) { nodes { ... on Actor { login } } }`); `reactors` was already requested for
its total, so this adds nodes, not connections. `GitHubReaction.reactors` carries them, and a
reaction chip's tooltip reads "alice, bob and 2 others reacted with 👍"
(`github/comment-reactors-label.ts`).

| File                                                      | What is ours                  |
| --------------------------------------------------------- | ----------------------------- |
| `src/main/github/client/fetch/pr-review-threads-query.ts` | The reactor logins.           |
| `src/main/github/comment-reactions.ts`                    | Mapping them onto `reactors`. |
| `src/shared/github/comment-types.ts`                      | `GitHubReaction.reactors`.    |
| `src/renderer/src/components/github/CommentReactions.tsx` | The tooltip on each chip.     |
| `src/renderer/src/i18n/locales/en.json`                   | `commentReactors.*`.          |

### 43. Pending review as its own Source Control section

Your unsent review comments leave the Review section (§36) for a Pending review section
(`pending-comments` in `SOURCE_CONTROL_SECTIONS`), under the shared section header so it
collapses, drags and hides like the others. It shows only while drafts are queued. Review keeps
the reviewers, diff base, standing and verdict form, and its header no longer counts drafts.

| File                                                         | What is ours                             |
| ------------------------------------------------------------ | ---------------------------------------- |
| `source-control/pending-review/pending-comments-section.tsx` | The section.                             |
| `source-control/pending-review/pending-review-shelf.tsx`     | The drafts disclosure removed.           |
| `source-control/panel/panel-ready.tsx`                       | The section's shelf.                     |
| `src/shared/source-control-sections.ts`                      | `pending-comments`.                      |
| `src/renderer/src/i18n/locales/en.json`                      | `sourceControlSections.pendingComments`. |

### 44. Keyboard scrolling in the combined diff

In View all and an agent turn's combined diff, the bare ↑/↓ keys scroll the view 40px, unless
focus is in something you type into (a text field, or an editable diff — Monaco marks a read-only
editor's input `aria-autocomplete="none"`). They are taken in the capture phase so a read-only
editor's hidden caret does not swallow them. The next/previous-file step (`editor.nextFile` /
`editor.previousFile`, whatever it is bound to) snaps the next or previous file's header to the
top while the combined diff is the active tab, instead of opening that file in its own tab:
`stepToChangedFile` asks `lib/combined-diff-file-stepper.ts` first.

| File                                                                   | What is ours                              |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `combined-diff/scroll-viewport/combined-diff-keyboard-scroll.ts`       | Which keys scroll; which file comes next. |
| `combined-diff/scroll-viewport/use-combined-diff-keyboard-scroll.ts`   | The listener and the file stepper.        |
| `combined-diff/CombinedDiffViewer.tsx`                                 | The hook.                                 |
| `src/renderer/src/store/slices/editor/actions/step-to-changed-file.ts` | Asking the combined diff first.           |

### 45. Tab drags over the Claude web view

The Claude web view's `<webview>` (`terminal-pane/ClaudeWebView.tsx`) is created outside the
browser-tab webview registry, so tab drags never made it click-through. A drag over it lost the
pointer to the guest page, and the window blur that followed tripped the missed-end fallback
(`tab-group/tab-drag-missed-end-listeners.ts`), dropping the tab nowhere. It now enrols in the
same drag passthrough (`terminal-pane/claude-web-drag-passthrough.ts`).

A tab drag also preview-activates the tabs it hovers, and the Claude cover handed focus to its
page whenever it was shown or focused. Focusing a guest blurs the embedder, which again read as the
drag ending, so a drag over a Claude tab, or bringing the dragged Claude tab back into the window,
dropped it. `focusClaudeWebview` holds that focus back while a drag is in flight, like browser
tabs do, and the page takes it once the drag ends if the cover still holds focus.

| File                                            | What is ours                                             |
| ----------------------------------------------- | -------------------------------------------------------- |
| `terminal-pane/claude-web-drag-passthrough.ts`  | The enrolment; `focusClaudeWebview`.                     |
| `terminal-pane/ClaudeWebView.tsx`               | Enrolling on attach, leaving on detach; drag-safe focus. |
| `terminal-pane/TerminalPaneClaudeWebPortal.tsx` | The cover's drag-safe focus hand-off.                    |

### 46. Turns and commits preview as a Changes filter

Clicking an agent turn, the Open Latest Agent Turn shortcut, Show in Changes on an expanded commit,
and showing a commit from git blame no longer open the combined all-files view. Each sets a filter
on the Changes list (`lib/changes-filter.ts`, via `lib/show-in-changes.ts`): the list shows that
turn's or commit's files under a removable badge — "Latest turn", "Historical changes" or
"Commit abc1234" — opens the first, and every file opens in the normal diff viewer
(`store/slices/editor/actions/open-changes-filter-entry.ts`, used by row clicks and keyboard steps):

- A turn, the latest one included, and a commit open their frozen `commit` diff: the latest turn is
  what that turn changed, not what a running agent is changing now.

Uncommitted (§38) is the same filter, so turning it on clears a turn or commit and the reverse.
A previewed turn turns "Historical changes" once a newer turn lands (`syncLatestAgentTurn`, from
`panel-ready.tsx`). The Changes header's View all button is gone. The combined view stays in the
code for the "Group by status" sections' view buttons.

| File                                                                                                                                                                                                                                                                  | What is ours                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/renderer/src/lib/changes-filter.ts`                                                                                                                                                                                                                              | The filter, replacing `uncommitted-only-store.ts`; badge labels.     |
| `src/renderer/src/lib/show-in-changes.ts`                                                                                                                                                                                                                             | Setting a turn or commit filter and opening its first file.          |
| `store/slices/editor/actions/open-changes-filter-entry.ts`                                                                                                                                                                                                            | Which diff a row opens under the filter.                             |
| `store/slices/editor/actions/open-diff-at-location.ts`, `source-control/listing/use-row-opening.ts`                                                                                                                                                                   | Asking it first.                                                     |
| `source-control/listing/use-all-changes-projection.ts`, `all-changes-section.tsx`, `all-changes.ts`, `panel/panel-content.tsx`                                                                                                                                        | The filtered list, the badge, commit-tab row highlight, no View all. |
| `src/renderer/src/lib/agent-turn-open.ts`, `agent-turns/agent-turns-section.tsx`, `sync/use-git-history-commit-actions.ts`, `sync/git-history-commit-files.tsx`, `src/renderer/src/lib/monaco-git-blame.ts`, `src/renderer/src/app-shell/source-control-shortcuts.ts` | The entry points.                                                    |
| `src/renderer/src/i18n/locales/*.json`                                                                                                                                                                                                                                | `allChanges.*`; the old "Open all changes together" key removed.     |

### 47. Group-focus arrows from the Claude web view

The Claude page forwards Orca's shortcuts from main (`src/main/claude/claude-web-guest-shortcuts.ts`),
but ⌥⌘+arrow (`tabGroup.focus*`) matched the worktree-history window action first, so it ran history
in main and focus never left the page. Like the main window's routing, the directional chord now
goes to the renderer ahead of window actions; it moves to the next group, or falls back to history
when there is only one.

| File                                            | What is ours                           |
| ----------------------------------------------- | -------------------------------------- |
| `src/main/claude/claude-web-guest-shortcuts.ts` | The directional chord forwarded first. |

### 48. Keeping the Claude web view in step with delivered prompts

Orca delivers prompts to Claude Code through its terminal (a launch prompt, or notes and comments
sent to a running agent). claude.ai's live view of the session does not always pick a locally typed
message up: it shows the agent working without the prompt until a reload. Each delivered prompt is
noted for its tab (`terminal-pane/claude-web-prompt-sync.ts`); that tab's Claude web view waits until
its page has loaded and four seconds have passed since delivery, reads the page text, and reloads
once if the prompt's opening line is not there, or if the page cannot be read.

| File                                                   | What is ours                                  |
| ------------------------------------------------------ | --------------------------------------------- |
| `terminal-pane/claude-web-prompt-sync.ts`              | The noted prompts, the check and the watcher. |
| `terminal-pane/ClaudeWebView.tsx`                      | The watcher per page.                         |
| `src/renderer/src/lib/agent-launch-prompt-delivery.ts` | Noting a submitted launch prompt.             |
| `src/renderer/src/lib/active-agent-note-send.ts`       | Noting a prompt sent to a running agent.      |

### 49. Agent notes read as markdown

Agent notes (`orca notes add` / `reply`) render through `CommentMarkdown`, like PR comments, so code
spans, paragraphs and lists show as such; the user's own notes stay the text they typed. The CLI
turns a literal `\n` in `--body` into a line break (agents pass paragraphs that way inside one quoted
argument; `\\n` stays literal), and its help tells agents to lead with the point and use short
paragraphs or a list.

| File                                                                                                | What is ours                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `src/renderer/src/components/diff-comments/DiffCommentCard.tsx`, `src/renderer/src/assets/main.css` | Markdown for agent notes.                  |
| `src/cli/handlers/notes.ts`, `src/cli/specs/notes.ts`                                               | `\n` in the body; the formatting guidance. |

### 50. Review workspaces open as the agent beside the first file

When the review inbox creates a "Reviewing" workspace (`workspace-status-rules/create-review-workspace.ts`),
after the review agent launches it fetches the PR's changed files against the workspace's base (in the
background, since the Source Control panel only loads the compare for the active worktree), seeds the
store with them, splits the agent's group to the right and opens the first file's diff there
(`workspace-status-rules/open-review-workspace-layout.ts`). A PR with no changed files, or a compare
that fails, leaves the agent on its own. Either way it ends by selecting the agent's tab in its group
(scoped to the review worktree), since the setup and default tabs open in that group too and would
otherwise be the one shown.

| File                                                     | What is ours                         |
| -------------------------------------------------------- | ------------------------------------ |
| `workspace-status-rules/open-review-workspace-layout.ts` | The split and the first file.        |
| `workspace-status-rules/create-review-workspace.ts`      | Running it after the agent launches. |

### 51. No Create PR in the Source Control header

Like the commit box (§35), the header's Create PR button is gone: PRs are opened by the agent or the
CLI. The panel passes the header no create-PR action, so the upstream header keeps its own behaviour
and tests.

| File                                   | What is ours                          |
| -------------------------------------- | ------------------------------------- |
| `source-control/panel/panel-ready.tsx` | `visibleCreatePrHeaderAction={null}`. |

### 52. Source Control as one scroll

The sections no longer share the panel's height. Opening one took height from another, so the
resizable group (`resizable-sections.tsx`, `shelf-sizing.ts`, §35–§36, §48) is replaced by one
scroller in which every section stacks at its natural height, in the user's order, still dragged and
hidden from its header (`panel/stacked-sections.tsx`). Section headers are no longer sticky, Commits
is no longer docked: it closes the list as its last section (`panel/commits-section.tsx`), so its
bottom scroll-padding tracking (`dock-scroll-padding.ts`) is gone. The Changes list still virtualizes
against that scroller, measuring its offset inside it. The "New pull request" composer
(`commit-surface.tsx`) is removed too: PRs are opened by the agent or the CLI (§51).

| File                                                        | What is ours                                             |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `source-control/panel/stacked-sections.tsx`                 | The single scroller and its ordered, droppable sections. |
| `source-control/panel/commits-section.tsx`                  | Commits as the last section.                             |
| `source-control/panel/panel-ready.tsx`, `panel-content.tsx` | Using them; no composer.                                 |
| `source-control/listing/section-header.tsx`                 | Not sticky.                                              |

### 53. A follow-up on a note goes straight to an agent

Submitting a reply under a note ("Ask a follow-up…") saves it and sends it at once, with the
thread's other unsent messages and the same context prompt as the note's send menu
(`formatDiffCommentsForAgent`), to the agent that menu auto-picks; when no agent is eligible it
starts the default agent in the card's group with that prompt (`lib/send-notes-to-best-agent.ts`).
The sent notes are marked sent once delivered. A failed send keeps them pending and says why.

| File                                               | What is ours                              |
| -------------------------------------------------- | ----------------------------------------- |
| `src/renderer/src/lib/send-notes-to-best-agent.ts` | Pick or start the agent, send, mark sent. |
| `diff-comments/agent-note-replies-list.tsx`        | Sending on submit.                        |
| `diff-comments/diff-comment-zone-card.tsx`         | The group a new agent opens in.           |
| `src/renderer/src/i18n/locales/en.json`            | `notesFollowUp.*`.                        |

### 54. A shortcut to the review summary

⇧⌥⌘R (`sourceControl.focusReviewSummary`, macOS only, rebindable) focuses the Review section's
summary box while the Source Control panel is showing one, opening the section first when it is
collapsed. It is a request the section takes up (`pending-review/review-summary-focus.ts`), since a
collapsed section has no editor yet; elsewhere the chord is left to whatever else is bound to it.
Escape in the box lets go of it.

| File                                                                 | What is ours                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/shared/keybindings/definitions-core-4.ts`, `types.ts`           | The binding.                                                   |
| `src/renderer/src/components/pending-review/review-summary-focus.ts` | The request and focusing the editor once it mounts.            |
| `app-shell/source-control-shortcuts.ts`                              | Taking the chord only with the panel showing a Review section. |
| `source-control/pending-review/pending-review-shelf.tsx`             | Expanding and focusing on request.                             |

### 55. The Changes header totals the listed lines

The Changes header shows +added −removed for the files it lists, so Uncommitted, a turn, a commit
and the file-type filter narrow it with the list. Every row needs its own exact count for that: the
branch total's ranged diff (merge base → working tree) now also returns its per-file counts
(`files` on `GitBranchLineTotal`), which a row touched both on the branch and since takes in place of
the per-area counts it could not add up. Turns and commits already count their rows.

| File                                                                                             | What is ours                                 |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `src/shared/git-branch-line-total.ts`, `git-status-types.ts`                                     | Per-file counts on the total.                |
| `src/shared/git-branch-line-total-files.ts`, `store/slices/editor/actions/git-status-actions.ts` | Republishing when only a file's count moved. |
| `source-control/listing/all-changes.ts`, `use-all-changes-projection.ts`                         | Rows taking the exact count.                 |
| `source-control/listing/all-changes-section.tsx`                                                 | The header total.                            |
| `src/renderer/src/i18n/locales/en.json`                                                          | `allChanges.lineTotal`.                      |

### 56. Review summaries show their verdict

A review summary in the PR panel carries the verdict it was submitted with (Approved, Changes
requested, Commented, Dismissed) as a badge beside the author, so it reads apart from a plain
comment. The Comments list no longer heads open threads with "Needs review · N".

| File                                                      | What is ours                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/shared/github/comment-types.ts`                      | `reviewState` on `PRComment`, `toPRReviewSummaryState`.                         |
| `src/main/github/client/fetch/pr-review-threads-query.ts` | `state` on `reviews.nodes`.                                                     |
| `src/main/github/client/fetch/get-pr-comments.ts`         | `reviewState` on both the GraphQL and the REST review summaries.                |
| `checks-panel/comment-row.tsx`                            | `<ReviewStateBadge>` after the author name (badge in `review-state-badge.tsx`). |
| `checks-panel/comments-list.tsx`                          | The "Needs review" label removed; open threads render first, unlabelled.        |

### 57. `orca file open --line/--column` — retired

Upstream shipped the same flags (#28240), so the fork's copy was dropped in the 1.4.214 sync of
October 2026. The number is kept so later entries keep theirs.

### 58. A file's editor and diff are one tab's two views

A file's working diff (unstaged, staged, branch, all-changes) and its editor are two views of one
tab. The header toggle shows Edit (Source / Rich for markdown) and Changes on both; switching
replaces the tab with the other view at the cursor's line. Changes opens the diff the Source Control
filter would (`openDiffAtLocation`, area `'branch-worktree'`), saving unsaved edits first, and does
nothing while a commit or turn is previewed or when the filter lists no change for the file.
Upstream's in-place Changes view (`ChangesModeView`) is retired: a tab still asking for it is handed
the diff tab. Diffs are read-only; editing happens in the editor, where completions and diagnostics
run. Opening one view in a group closes the other there, unless it holds unsaved edits or is also
open in another group. ⌥⌘E (`editor.showEdit`) and ⌥⌘D (`editor.showDiff`) switch views, macOS
only and rebindable; ⌥⌘E replaced F4's "Open File from Diff", and the header's "Open file tab"
button is gone.

| File                                                                                            | What is ours                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/renderer/src/components/editor/file-tab-view-switch.ts`, `reveal-line-after-open.ts`       | Switching views at the cursor's line.                    |
| `editor/one-view-per-file.ts`, `use-retired-changes-mode.ts`                                    | One view per file in a group; the retired in-place view. |
| `editor/markdown-preview-controls.ts`, `editor-panel-render-model.ts`                           | The toggle on single-file diffs, Changes selected.       |
| `editor/EditorPanel.tsx`, `EditorPanelHeader.tsx`, `EditorPanelShell.tsx`                       | Toggle routing; the "Open file tab" button removed.      |
| `editor/diff-navigation-context.tsx`, `editor-shortcuts.ts`, `diff-shortcuts-outside-editor.ts` | ⌥⌘E inside and outside a diff, at its cursor line.       |
| `components/terminal-workspace-editor-shortcuts.ts`                                             | ⌥⌘D from an editor.                                      |
| `editor/EditorDiffFileSurface.tsx`, `EditorContent.tsx`                                         | Read-only diffs.                                         |
| `src/shared/keybindings/definitions-core-4.ts`, `types.ts`                                      | The bindings.                                            |

### 59. The modal blur keys off a body attribute, not `body:has()`

Upstream blurs the workspace behind a dialog, sheet or onboarding with
`body:has(> [data-slot='dialog-overlay'], …) .app-layout > :not(.window-controls)` (#33799). Chromium
re-checks that `:has()` for every node inserted anywhere in the page, and a match restyles the whole
app, so scrolling an editor spent ~37 s of style recalc per 60 wheel ticks. The fork sets
`data-modal-scene` on `<body>` from a `MutationObserver` on its direct children and keys the blur off
that; the same scroll takes ~0.5 s. A test forbids `body:has()` rules that reach past the toaster.

| File                                                 | What is ours                                       |
| ---------------------------------------------------- | -------------------------------------------------- |
| `src/renderer/src/lib/modal-scene-attribute.ts`      | The observer.                                      |
| `src/renderer/src/main.tsx`, `space.tsx`             | Installing it.                                     |
| `src/renderer/src/assets/main.css`                   | `body[data-modal-scene]` in place of `body:has()`. |
| `src/renderer/src/assets/main-css-has-scope.test.ts` | The `body:has()` reach guard.                      |

## Verify

Verify runs on GitHub, not locally: `fork-verify.yml` runs it on every pull request against `main`,
and its `fork verify` check is the gate. It runs

```bash
pnpm lint
pnpm typecheck
./config/scripts/test-fork-features.sh
```

plus the update-channel greps below. Read a failure with `gh run view <run> --repo frbarbre/orca
--log-failed`; reproduce only the failing files locally.

**Tests are only the fork's own.** `test-fork-features.sh` runs every test file a fork commit touched —
derived from git, not listed, because a commit reachable from `upstream/main` is upstream's and
everything else is ours. A fork change that adds a test is covered by it automatically. Upstream's full
`pnpm test` and every e2e suite are deliberately not run: upstream's own CI runs them on upstream's
commits, and on a fork runner they only bury the fork's failures among upstream's environmental ones.
The script skips `tests/e2e/`.

Run the **full** `pnpm lint`, not just `pnpm run check:code-quality:changed`. The per-change gate is
what keeps day-to-day commits clean, but it reports warnings without denying them and skips the
localization checks entirely — the first sync found three gaps it had let through.

Upstream's own pull-request workflows are disabled on this repository, so `fork verify` is the only
check a pull request gets (plus the fork's preview build). A sync can bring in a new one, which starts
enabled, so after every merge run:

```bash
node config/scripts/fork-disable-upstream-pr-workflows.mjs
```

The workflow also confirms the fork channel actually survived the merge — a clean test run does
**not** prove this, because the defaults are upstream's on purpose:

```bash
# Each must print a match. A miss means the update channel was lost in the merge.
grep -n "armForkUpdateChannel" src/main/index.ts
grep -n "ORCA_RELEASES_REPO_URL" src/main/updater-release-repo.ts
grep -n "ORCA_UPDATE_FEED_URL" src/main/updater/updater-setup.ts src/main/updater/updater-release-feed.ts
grep -n "isManualInstallOnlyUpdate" src/main/updater/updater-download-install.ts
grep -n "isForkSelfInstallUpdate" src/main/updater/updater-download-install.ts
grep -n "frbarbre" config/electron-builder.config.cjs
```

If a fork test fails, check whether upstream broke it before assuming the fork did: upstream can
change code a fork test depends on. Compare against a clean upstream checkout, not a stash:

```bash
git worktree add --detach /tmp/orca-up upstream/main
ln -s "$PWD/node_modules" /tmp/orca-up/node_modules
(cd /tmp/orca-up && npx vitest run --config config/vitest.config.ts <failing files>)
```

`test-fork-features.sh` fetches `upstream/main`, so upstream can move **during** a sync. Before
blaming the merge for a failure, check whether upstream fixed it after the merge point — the first
sync hit exactly that (#23062 landed two commits later) and was fixed by merging again.

### Sync log

**1.4.214 → 1.4.214** (`293bfe795d..36d295628e`, 1058 upstream commits, eighty-three conflicts)

- `package.json` still says 1.4.214, so the branch name repeats an eleventh time; the earlier pull
  requests for it are merged, so a new one is opened on the same name.
- Upstream's repository-wide comment cleanup (#33249) rewrote comments beside fork code in most of
  the conflicted files. Hunks where upstream changed only comments kept the fork's code (with the
  old comment); hunks where the fork changed only comments took upstream's. A diff3 conflict style
  (`git checkout --conflict=diff3`) makes those easy to tell apart.
- Generated and locale files — `bundled-skill-guides.ts`, `en.json`, `en-runtime-required.json`, the
  six translated locales: took upstream's and regenerated (`pnpm install`,
  `generate:bundled-skill-guides`, `sync:localization-catalog`, `sync:localization-runtime-catalog`).
  The RPC catalog was already current.
- `updater-release-feed.ts` — upstream's fallback now pins the latest stable tag
  (`fetchLatestStableReleaseTag`, hardcoded to stablyai) instead of `releases/latest/download`.
  The fork returns early on `ORCA_UPDATE_FEED_URL`, and a fork fix commit derives the stable-tag
  lookup from the release repo too. The feed file was past its 300-line cap, so the fork's URL
  derivation moved to `updater-release-repo.ts`; the Verify grep in `fork-verify.yml` follows it.
- `updater-setup.ts`, `runtime-file-watcher-removal.ts`, `main-window-shortcut-routing.ts`,
  `main-process-ipc-bootstrap.ts`, `use-app-shell-services.ts`, `ui-slice-contract-preferences.ts`,
  `repo-types.ts`, `panel-content.tsx`, `monaco-setup.ts`, `tab-drag-pointer-sensor.ts`,
  `checks-list.tsx`, `use-checks-panel-comment-mutations.tsx`, `branch-entry-row.tsx`: both sides
  added lines or imports; kept both.
- `filesystem.ts` and `RepositoryPane.tsx` moved into `ipc/filesystem/` and `settings/repository/`;
  took the moves with the fork's imports re-pointed (`PythonEnvironmentSection` and
  `fork-repository-sections` stay in `settings/`).
- `register-app-menu.ts` — upstream moved Reload / Force Reload / DevTools into
  `createAppMenuReloadAndDevToolsItems` and quit into `createAppMenuQuitItems`. Took both; the
  fork's DevTools-on-the-window item is gone, and Paste stays in `app-menu-paste-item.ts`.
- Worktree removal — upstream now finishes any partial removal Git deregistered, macOS "Directory
  not empty" included, which is what the fork's Finder fix did, so `local-worktree-removal-recovery.ts`
  (+ test) is upstream's. Upstream also added native Windows removal; `worktree-removal-leftover.ts`
  and `runtime-interrupted-local-worktree-removal.ts` keep the fork's `provesFailedRemovalLeftover`
  beside it (off the native path). `worktree-failed-removal.test.ts` is upstream's, which dropped
  the retry tests the fork's leftover cases sat in. This leftover-folder work is not yet listed in
  [What this fork owns](#what-this-fork-owns).
- `use-global-keybindings.ts` — upstream folded the editable/floating-terminal checks into
  `globalShortcutTargetYields`; the fork's group-focus chord runs just before it.
- `HostedReviewActions.tsx` — upstream reworked stacked-PR merging; kept the fork's panel without
  merge buttons (§13). `CommentMarkdown.tsx` — upstream's math rendering inside the fork's
  `MediaGalleryProvider`. `section-header.tsx` — upstream's pluralized conflict count in the fork's
  header. `TerminalPaneHeaderOverlay.tsx` — upstream's `canCloseTerminalPane` plus the web-view leaf
  check. `textarea.tsx` — fork's `seamless` beside upstream's `composite`.
- Deletions: took upstream's of `activity-bar-overflow.test.ts`,
  `source-control-branch-section-heading.test.tsx` (§2's re-apply has nothing left to go into) and
  `card-properties.test.ts`; kept the fork's of `commit-surface.tsx` and the right-panel composer's
  IME test and focus timers.
- **Found after the merge, not by git** (fork fix commit): upstream moved `ipc/filesystem-path-containment`,
  the parcel watcher process files (`ipc/filesystem/watcher-process/`), `filesystem-watcher-ignore`
  (`ipc/filesystem/watchers/`) and the source-control `section-order` (now
  `shared/source-control-section-order.ts`). Upstream renamed the shared "Switch to terminal view"
  key's text, so the Claude web error card has its own key; the chat View item takes upstream's
  nullable shortcut label.
- Verify round 1: upstream's shortcut settings now need a title for every action (the fork's live
  in `settings/fork-keybinding-title-copy.ts`); settings transfer had to classify three new fields;
  `defaultLabel` and `deriveNotesSendAgentTargets`' arguments changed. Three files hit their line
  caps: the fork's IPC registrations moved to `register-fork-core-handlers.ts`, the fix-checks
  background surface to `fix-checks-agent-surface.ts`, and the Auto-picked row became a memo
  component so upstream's `ReviewNotesSendMenuContent.test.tsx` (exactly at its cap) needs no fork
  lines. 31 locale keys only fork-removed UI used were deleted from every catalog. And upstream's
  flaky-test ratchet crashed (`spawnSync git ENOBUFS`) listing a sync's changed files against
  origin/main, so `fork-verify.yml` fetches upstream and runs `pnpm lint` with
  `ORCA_CODE_QUALITY_BASE=upstream/main`, scoping the changed-file ratchets to the fork's own diff.
- Verify round 2: that scope surfaced sleeps and wall-clock reads in nine fork tests; fixed, with
  `ast-grep-ignore` reasons on the e2e pauses that prove an absence.
- Main gained fourteen fork commits while Verify ran, so it was merged into the branch: two
  conflicts (`EditorPanel.tsx`'s diff provider, the image-preview test's imports). The new review
  video node used upstream's deleted `safe-react-node-view-renderer` and now uses the stock
  renderer; main's stepper test moved to `native-chat-image-stepper.test.tsx` to keep the
  image-preview test under its cap.
- Verify on that merge: main's new `editor.openFileFromDiff` (F4) needed a shortcut title.
- Main gained four more commits (a file's editor and diff become one tab's two views) before that
  Verify finished, so it was merged again: three conflicts beside upstream's comment rewrites, and
  F4's action is gone, so its title is too.
- Verify on that merge: main's new `editor.showEdit`/`editor.showDiff` needed shortcut titles, and
  main's removal of the old Open file strings missed `ru`, `tr` and `zh-Hant`.

**1.4.214 → 1.4.214** (`88aa3f27ce..293bfe795d`, 604 upstream commits, thirty-five conflicts)

- `package.json` still says 1.4.214, so the branch name repeats a tenth time; the earlier pull
  request for it is merged, so a new one is opened on the same name.
- Generated files — `bundled-skill-guides.ts`, `rpc-params-catalog.generated.ts`, `en.json`,
  `en-runtime-required.json`: took upstream's and regenerated after `pnpm install` (upstream's
  lockfile moved). `runtime-git-api-contract.test.ts`: upstream deleted it (#32206); took the delete.
- Imports and list entries both sides added — `cli/specs/index.ts` (notes and ports specs),
  `main.tsx`, `runtime-git-status-client.ts`, `web-git-api.ts`, `repo-types.ts` (upstream's moved
  `jira/jira-project-reference` plus the fork's `CiTriageConfig`), `global-settings-types.ts`
  (fork's `ForkBaseSettings` stays; upstream's `GlobalSettingsBase` import dropped as unused),
  `app-api.ts`, `runtime-file-watcher-removal.ts` (fork's language-server stop beside upstream's
  comment): kept both. Upstream stripped doc comments in `worktree-removal-leftover.ts` and
  `worktree-metadata-merge.ts`; took that, kept `provesFailedRemovalLeftover`.
- `updater-prerelease-feed.ts` — upstream reasserted a module-level `TAG_HREF_RE`. Kept the fork's
  derived `tagHrefPattern()` (§1).
- `register-app-menu.ts` — upstream's `resolveNativeEditTarget` now covers webviews, which is what
  the fork's paste item did. Took upstream's logic, but back in `app-menu-paste-item.ts`: inlined,
  the fork's View section submenus put the file past its 300-line cap.
- Upstream reverted HTML preview by default (#31893), renaming the row openers back
  (`openUncommittedFile` → `handleOpenDiff`, `openBranchFile` → `openCommittedDiff`) and deleting
  `lib/workspace-file-open.ts`. `use-row-opening.ts`, `use-file-listing.ts`, `panel-content.tsx` take
  the old names with fork #35/#46's `activeOpenRowKey`, `openAllChangesEntry` and filter follower
  re-applied; `open-change-entry.ts` opens through `openUncommittedEntry`. `SourceControl.preview-open.test.tsx`
  takes upstream's tests minus the fork-deleted commit-box ones, and keeps a `getKnownWorktreeById`
  mock for the fork's PR comment scope. `branch-entry-row.tsx` keeps its `data-source-control-*`
  attributes, which upstream dropped.
- Upstream combined untracked files into Changes (#31831): `sourceControlGroupOrder` is now
  `SourceControlDisplaySectionArea[]` and `filterSourceControlGroupedPathEntries` is gone. Fork #17's
  category narrowing and `filteredGrouped` (the all-changes list reads it) now live in
  `listing/use-file-category-grouping.ts`, which also keeps `use-file-projection.ts` under its cap.
- Upstream added its own clickable PR comment locations (#32031, `CommentLocationLabel`, opening
  the file in the editor). The fork's §2 `onOpenLocation(comment)` opens the diff at the line and
  was kept in `comment-row.tsx`, `comment-group.tsx`, `comments-list.tsx`,
  `use-comments-list-state.tsx` and `active-content.tsx`; upstream's `(path, line)` wiring and
  `openAnnotationLocation` call were dropped. Upstream's `fixChecksDisabledReason` is applied to the
  fork's triage strip. Upstream's new `comment-row.test.tsx` cases for `CommentLocationLabel` fail
  on the fork; Verify does not run them.
- `MarkdownImageLightbox.tsx` — upstream's controlled `ExpandableMarkdownImage` (native chat image
  previews: `open`, `triggerRef`, `dialogProps`, `PanZoomImageDialog`) against fork #15's gallery.
  The image takes upstream's component and, when uncontrolled inside a `MediaGalleryProvider`,
  registers with and opens the gallery instead; videos stay on the fork's `MediaLightbox`.
- `virtualized-list.tsx` — upstream's `activeRowKey` / `minimumRows` / `rangeExtractor` (quick
  command dropdown) beside the fork's `scrollToRowKey` effects.
- `worktree-review-helpers.tsx` — upstream's `showChecks`; the fork's running spinner now also
  respects it.
- `use-native-chat-context-menu.test.tsx` — upstream dropped the layout-section mock; kept the
  fork's `AgentViewSubmenu` mock. `use-file-projection-work.test.tsx` takes upstream's group order
  plus the fork's category constants. `web-preload-api-composition.test.ts` and
  `web-preload-api-github.test.ts`: upstream retired both inventories, so §3's
  `'reviewStatusRules'` re-apply has nothing left to go into.

**1.4.214 → 1.4.214** (`4298ba998d..88aa3f27ce`, 615 upstream commits, thirty-two conflicts)

- `package.json` still says 1.4.214, so the branch name repeats a ninth time; the earlier pull
  request for it is merged, so a new one is opened on the same name.
- Generated files — `pnpm-lock.yaml`, `bundled-skill-guides.ts`, `en.json`: took upstream's and
  regenerated. Upstream's lockfile drops fork #28's `material-icon-theme`, so this needed
  `pnpm install`, then `generate:bundled-skill-guides`, `sync:localization-catalog` and
  `sync:localization-runtime-catalog`.
- Imports both sides added — `main-process-ipc-bootstrap.ts`, `main-window-agent-status.ts`,
  `DiffSectionItem.tsx`, `use-filters.ts`, `git-status-actions.ts`: kept both. `app-api.ts` and
  `use-worktree-card-review-details.ts` keep only the imports still used.
- `main.tsx` — upstream retired the sidebar shadow comparison. Dropped it; kept the fork's Material
  icon sync, right-sidebar-follows-file and `VITE_ORCA_RELEASES_REPO` override.
- `lib/language-detect.ts` — upstream moved the table to `shared/editor-language/editor-language-detect.ts`
  and re-exports it. Took that and re-added fork #26's `.pyi` → `python` there.
- `FileExplorerRow.tsx`, `branch-entry-row.tsx`, `uncommitted-entry-row.tsx` — upstream renders file
  icons through `<FileTypeIcon>`, which still calls the fork's Material `getFileTypeIcon`. Took it;
  the explorer keeps its 16px icons and the fork's `MaterialFolderIcon`, the branch row its
  open-file highlight next to upstream's new `data-source-control-*` attributes.
- `use-row-opening.ts`, `use-file-listing.ts`, `panel-content.tsx` — upstream renamed the row openers
  (`handleOpenDiff` → `openUncommittedFile`, `openCommittedDiff` → `openBranchFile`) and routes them
  through `openWorkspaceFile`, and the selection hook's `onOpenDiff` became `onOpenFile`. Took the
  new names and re-applied fork #35/#46's `activeOpenRowKey`, `openAllChangesEntry` (now calling
  `openUncommittedFile`) and filter follower; `detectLanguage` is imported again for them.
- `git-branch-line-total.ts` (+ both tests) — upstream now returns null when an untracked path is
  also in the tracked range, instead of adding both halves. Took that; fork #55's per-file `files`
  map is now a plain union of the two disjoint maps, and its test for adding up a recreated file
  is gone. The real-git test takes upstream's `toBeUndefined()`.
- `useTabGroupCloseScopeCommands.ts`, `useTabGroupWorkspaceModel.ts` — upstream reads tabs from the
  store and confirms bulk closes with a dialog. Took it; the fork's `closeOthers(itemId, keep)` and
  `closeAllUnpinned(keep)` (the ⌥⇧⌘W chord) read the store too and close without the dialog,
  since the chord closes the other groups unprompted anyway.
- `SortableTabContextMenu.tsx` (+ test) — kept the fork's `AgentViewSubmenu` and leading separator,
  added upstream's `onComplete`. The test keeps both module mocks.
- `diffComments.ts` — upstream passes the comment ids to `mutateDiffComments`. Added that argument to
  the fork's mark-as-sent mutation.
- `compute-visible-worktrees.ts`, `use-visible-worktrees.ts` — upstream ranks by host identity
  (`rankOf`, `ancestorByIdentity`) and reads `selectWorktreesByRepo`. Took both; fork #9's
  temporary-checkout filter still runs on the rows first.
- `settings-page-renderer.tsx` — upstream wrapped the sections in a scroll provider. Took it and
  re-added the Language Servers section after Git. `WorktreeOpenInMenu.tsx`: upstream's item wrapper
  plus the fork's Mod+O label. `button.tsx`: both `ghost-destructive` and upstream's
  `destructive-chip`.
- `SourceControl.preview-open.test.tsx` — kept the commit-box tests removed and took upstream's new
  HTML preview tests. Upstream's two "HTML review note" tests click its notes shelf's Expand notes,
  which the fork's Agent notes section replaces, so they are dropped, as is a duplicated
  `getKnownWorktreeById` mock key.
- Verify took three rounds. Upstream retired `AgentIcon` in `ReviewNotesSendMenuContent.tsx` for
  `AgentTypeIcon`; the fork's auto-picked row uses that too. Upstream's `<FileTypeIcon>` passes
  `aria-hidden`, so `MaterialIconProps` and the native chat pill's `icon` prop both take React's
  `AriaAttributes['aria-hidden']`. `use-global-keybindings.ts` hit the line cap again; the
  group-focus chord's two branches are one check now. `repos:update` is async and writes by
  `repoTarget(...)`, so the fork's venv-path and port-labels tests await it.
- Upstream added two read ratchets that fork code tripped. Repo host reads: `agent-turn-recorder.ts`
  asks `getRepoRoutingConnectionId(repo)` instead of reading `repo.connectionId`. Workspace record
  reads (`check-workspace-record-read-ratchet.mjs`): status-rule targets and agent notes read through
  `selectWorktreesByRepo`; `language-server-editor.ts` destructures the field, because its state type
  is structural and its tests fake it. New fork code that reads `worktreesByRepo`,
  `folderWorkspaces` or `connectionId` should use those selectors from the start.

**1.4.214 → 1.4.214** (`1b1d09cfb5..4298ba998d`, 695 upstream commits, nineteen conflicts)

- `package.json` still says 1.4.214, so the branch name repeats an eighth time. The earlier sync's
  pull request for this branch is merged, so a new one is opened on the same branch name.
- Generated files — `bundled-skill-guides.ts`, `en.json`: took upstream's and regenerated
  (`generate:bundled-skill-guides`, `sync:localization-catalog`,
  `sync:localization-runtime-catalog`). The RPC catalog was already current.
- `compute-visible-worktrees.ts` — upstream moved the sidebar's filter, lineage and sort into the
  shared `selectVisibleSidebarWorktrees` (`shared/sidebar-list/visible-worktrees.ts`). Took it and
  apply fork #9's temporary-checkout filter to the rows before they go in, so the shared selector
  stays upstream's.
- `use-worktree-card-controller.ts` — upstream reads card properties from
  `foundation.cardDetails` (`getWorktreeCardDetails`). Took it; fork #7/#8's `showLinearTitle` and
  `showPrAuthor` still read `foundation.cardProps`, so the shared details type stays upstream's.
- `global-settings-types.ts` — upstream composes `GlobalSettings` from a new `GlobalSettingsBase`.
  The fork's `ForkBaseSettings` (`fork-source-control-settings.ts`) now extends that instead of
  `NativeChatGlobalSettings` (fork fix commit), so the only fork line left there is the import.
- `main-window-agent-status.ts` — upstream moved the first-work branch rename out of the hook
  listener (#29429). Took the removal; fork #31's `observeAgentTurn` call stays.
- `MarkdownImageLightbox.tsx` — upstream's single-image dialog became a pan-and-zoom
  `PanZoomImageDialog` (#30154). Kept the fork's `MediaLightbox` gallery whole (#15), as last sync.
- `TerminalContextMenu.tsx` — upstream's Copy Context item became `AgentSessionContextCopyMenuItem`;
  took it and kept fork #18's `AgentViewSubmenu`.
- `NativeChatExperimentalSetting.tsx` — upstream dropped `NativeChatSupportedAgents`; kept only the
  fork's `ClaudeWebDefaultViewSetting` import.
- `register-core-handlers.test.ts` — kept the fork's `keybindings` argument to the dashboard popout
  beside upstream's new `registerWorkspaceSpaceWindowHandlers` expectation.
- `repos-local-add-and-project-setup.test.ts` — kept the fork's Python venv and port labels cases;
  took upstream's now-async visibility case.
- Import-only conflicts, kept both sides: `main-process-i18n-menu.ts`, `app-api.ts`,
  `EditorPanelHeader.tsx` (`AgentNotesPill` beside upstream's renamed `EditorPanelActionsMenu`),
  `main.tsx` (fork's release-repo override beside upstream's sidebar shadow comparison),
  `git-status-actions.ts`, `meta-types.ts`, `types.ts`, `TabBarQuickCommandsButton.tsx`.
- **Found after the merge, not by git:** upstream moved `store/slices/github-cache-key.ts` to
  `shared/github/github-cache-key.ts` (#30026); five fork files imported the old path (fork fix
  commit). The missing-import scan caught it; limit it to files that differ from `upstream/main`, or
  upstream's own test fixtures bury the result.
- The port-name work (`workspace-port-labels.ts`, `PortLabelsCommandSection.tsx`,
  `portLabelsCommand` on repos) is fork work not yet listed in [What this fork owns](#what-this-fork-owns).
- Verify round 1: typecheck failed on two upstream removals that merged without conflict.
  `parcel-watcher-process.ts` no longer re-exports its types (#30369), so the language-server
  watcher imports them from `parcel-watcher-process-protocol.ts` / `-subscription.ts`; and
  `setupScriptLaunchMode` is gone (#29819, setup always runs in its own Setup tab), so the fork's
  `launch-worktree-background-terminals.ts` copy dropped its split-pane setup path to match.

**1.4.214 → 1.4.214** (`9c1d5d2fb7..1b1d09cfb5`, 475 upstream commits, thirty-five conflicts)

- `package.json` still says 1.4.214, so the branch name repeats a seventh time.
- Generated files — `bundled-skill-guides.ts`, `en.json`: took upstream's and regenerated
  (`generate:bundled-skill-guides`, `sync:localization-catalog`,
  `sync:localization-runtime-catalog`). The fork's keys came back.
- **Upstream shipped `orca file open --line/--column`** (#28240), the same feature as fork #57, and
  moved the runtime file commands into domain owners (#27582: `runtime-file-command-host.ts` and
  `runtime-file-command-access.ts` are gone, `construction/runtime-file-command-state.ts` and
  `files/file-access.ts` replace them). Took upstream's side of every #57 file — CLI spec and handler,
  `files-params.ts`, `rpc/methods/files.ts`, `runtime-notifier-contract.ts`,
  `runtime-window-lifecycle.ts`, the two preload bridges, `mobile-terminal-close-ipc-bridge.ts` —
  and deleted the fork-only `reveal-opened-file.ts` (+ test), `shared/runtime-file-reveal.ts` and
  `files-open-navigation.test.ts`. #57 is marked retired.
- **Upstream rebuilt Workspace options on one shared evaluator** (#28915, #28931, #28986):
  `visible-worktree-kinds.ts` and `SidebarWorkspaceFilterSection.tsx` are gone, filtering lives in
  `shared/workspace-view/workspace-row-filters.ts` and `compute-visible-worktrees.ts`, and the menu
  renders from shared option lists. Took upstream's `visible-worktrees.ts`,
  `sidebar-filter-actions.ts`, `use-filters.ts`, `SidebarFilter.tsx`,
  `workspace-options-menu-items.tsx` and `sidebar-workspace-option-items.ts`, then re-applied fork #9
  beside the shared evaluator rather than inside it (so the phone wire and upstream's filter types
  stay as they are) — see #9 for where each piece now lives — and fork #7/#8's Linear title and PR
  author through `withForkCardDisplayOptions`.
- `register-app-menu.ts` — upstream added a native-browser-popup branch to the inline Paste item;
  the fork extracted that item to `app-menu-paste-item.ts`, so the branch moved there.
- `handler-group-manifest.ts` — upstream added Jira and reference groups; kept them and the fork's
  `BROWSER_AND_FORK_HANDLER_GROUPS` in place of `BROWSER_HANDLER_GROUPS`.
- `SortableTabContextMenu.tsx` — upstream's `nativeChat` replaces `structuredSessionId`; kept the
  fork's `AgentViewSubmenu` and its always-on leading separator.
- `MarkdownImageLightbox.tsx` — upstream added `onError` to the old dialog; the fork's
  `MediaLightbox` version already had it. Kept the fork's.
- `jira-issue-workspace-content.tsx` — took upstream's `JiraIssueMarkdown`.
- `app-bridge.ts`, `use-app-shell-services.ts`, `ui-slice-preference-actions.ts` — both sides added
  lines; kept both.
- Tests: took upstream's deletion of `pr-comment-presentation.test.ts`, `section-header.test.tsx`
  and `file-type-icons.test.ts` (#29135, "remove low-value coverage"); in
  `section-action-buttons.test.tsx` and `CommentMarkdown.github-attachment-image.test.tsx` kept the
  fork's cases with upstream's new mocks.
- **Found after the merge, not by git:** upstream deleted `launch-worktree-background-terminals.ts`
  (#28130, automations now provision setup in main), which the fork's review-workspace creation
  imports. The fork keeps its own copy (see #8). `lib/worktree-git-identity-display.ts` moved to
  `shared/worktree/git-identity-display.ts`. A missing-import scan over `src` caught both; run one
  after every sync, since git merges a deleted dependency without conflict.

**1.4.214 → 1.4.214** (`e72044a936..9c1d5d2fb7`, 532 upstream commits, twenty-three conflicts)

- `package.json` still says 1.4.214, so the branch name repeats a sixth time.
- Generated files — `bundled-skill-guides.ts`, `rpc-params-catalog.generated.ts`, `en.json`: took
  upstream's and regenerated (`generate:bundled-skill-guides`, `generate:rpc-params-catalog`,
  `sync:localization-catalog`, `sync:localization-runtime-catalog`). This needed `pnpm install`.
- **Upstream deleted the SSH relay** (#27215, #27644): `src/relay/` is now `src/wsl-guest/` with no
  git handlers, and `ssh-git-working-tree-provider.ts` / `ssh-git-dispatch` are gone. Took every
  deletion, so the fork's relay `git.checkReviewAttributes` handler (`git-handler-check-attr.ts`,
  its registration and read-operation), the SSH provider's `checkReviewAttributes`, and the two
  relay branch-line-total tests went with it. The fork's `git:checkReviewAttributes` IPC now uses
  upstream's `requireReachableGitRoute`, as `git:checkIgnored` does; remote hosts answer through the
  runtime RPC (`git.checkReviewAttributes`), which is unchanged.
- `runtime-git-client.ts` — upstream removed the barrel (#27977). Took the deletion; the fork's
  importers now import from `runtime-git-diff-client`, `runtime-git-status-client` and
  `runtime-git-client-context` directly.
- `runtime-git-status-commands.ts` — upstream moved the provider types to
  `providers/git-provider-contract.ts`; took it beside the fork's `GitPathReviewAttributes` import.
- `open-file.ts` — upstream moved `DiffSource` and the snapshot types to
  `src/shared/editor-tab-view-types.ts`. Took the move and re-added the fork's `'branch-worktree'`
  to `DiffSource` there.
- `useEditorPanelDiffContentLoader.ts` — upstream's git contexts now carry `target: fileTarget`
  instead of `settings`. Kept the fork's `loadBranchWorktreeDiff` branch on that context, plus
  upstream's SAFETY comment and split imports.
- `active-content.tsx`, `use-checks-panel-controller-state.tsx` — upstream added `checksError` and
  `commentsError` (a failed read says so instead of "No checks"/"No comments"). Kept the fork's
  `PrPanelSections` layout and passed `checksError` to the Checks section and `commentsError`
  through `comment-sections.tsx`. The fork's comment list stays in the shared PR comments store;
  the error state and its clearing `setComments` wrapper now live in
  `use-checks-panel-comments-state.ts` (the controller sat at its line cap).
- `NativeChatExperimentalSetting.tsx` — upstream moved resume, queue-follow-ups and shell
  environment into `ChatBehaviorSetting`. Took upstream's file and kept only the fork's
  `ClaudeWebDefaultViewSetting` under the Chat UI switch.
- `CommentMarkdown.tsx` — upstream wraps each block in `CommentMarkdownBlockLineContext`. Took it
  inside the fork's `MediaGalleryProvider`.
- `SourceControl.preview-open.test.tsx` — upstream now stamps the repo's owner and focuses
  `runtime-other`; kept the fork's `sourceControlGrouping: 'status'` beside it.
- Import-only conflicts, kept both sides: `cli/specs/index.ts` (fork `notes` beside upstream's
  `reference`), `rich-markdown-extensions.ts` (`RuntimeFileOperationArgs` now from
  `runtime-file-client-types`), `SortableTabContextMenu.tsx` (`CopyTabIdMenuItem`),
  `TerminalPaneSurface.tsx` (`TerminalPaneSleepingPortals`), `active-agent-note-send.ts`
  (`noteClaudePromptDelivered` beside upstream's owner-environment target).
- Fork fix commit, for upstream API removals that merged without conflict: `@/lib/repo-runtime-owner`
  lost `getRepoOwnerRoutedSettings` and `worktree-runtime-owner` lost
  `getSettingsForWorktreeRuntimeOwner` (#27430), and `RuntimeGitContext` / `RuntimeFileOperationArgs`
  now take the owner's `target`. `use-commit-resolves.ts`, `use-review-attributes.ts`,
  `open-review-workspace-layout.ts` (now takes a `resolveTarget` dep), `agent-notes.ts`,
  `use-quick-open-text-search.ts` (`searchRuntimeFiles` is now in `runtime-file-search-client`) and
  `review-comment-create-action.ts` (`getGitHubSourceTarget`) moved over. `src/shared/child-process/`
  is now the `@orca/process-host` package (`spawnProcess`, `.../process-tree-termination`), which
  the language-server process and the self-installer import. The rule in AGENTS.md still names
  the old path.
- Upstream added four pull-request workflows (`preflight-benchmark.yml` and three
  `zcode-*-contract.yml`); the disable script turns them off once they are on GitHub; their four
  runs on the PR were cancelled.
- Verify round 1: `handler-group-manifest.ts` and `comments-list.tsx` were over their line caps, so
  the fork's `notes` CLI group rides on upstream's browser spread from `cli/fork-handler-groups.ts`
  and the comment View menu moved to `comment-display-mode-menu.tsx`; upstream's new chat prompt
  pill typed its icon as a Lucide icon, so it now takes any component (the fork's Material file
  icons are `<img>`s); `create-review-workspace.ts` passes the repo owner's `target` to
  `resolveGitHubPrStartPointForRepo`.
- Verify round 2: two new upstream ratchets in `pnpm lint`. The focus-read ratchet counts
  `getRuntimeEnvironmentIdForWorktree` as a read of the focused server, so new code routes by
  `runtimeTargetForWorkspaceOwner` / `useWorktreeGitOwnerTarget` instead. The renderer
  layout-writer ratchet (#27431) baselined every existing writer of `openFiles` and friends but the
  fork's `open-branch-worktree-diff.ts` and `git-branch-compare-actions.ts`; both joined
  `config/renderer-layout-writer-baseline.txt` at one write each. A fork change that adds a layout
  write must go through that baseline too, or better, through upstream's layout commands.
  `pnpm lint` stops at its first failing step, so a red lint can hide later ones.

**1.4.214 → 1.4.214** (`cc6006779f..e72044a936`, 387 upstream commits, twenty-three conflicts)

- `package.json` still says 1.4.214, so the branch name repeats a fifth time.
- Generated files — `bundled-skill-guides.ts`, `rpc-params-catalog.generated.ts`, `en.json`,
  `en-runtime-required.json`: took upstream's and regenerated (`generate:bundled-skill-guides`,
  `generate:rpc-params-catalog`, `sync:localization-catalog`, `sync:localization-runtime-catalog`).
  This needed `pnpm install`.
- `src/main/runtime/rpc/methods/git-params.ts` — upstream deleted the re-export file; `git.ts` now
  imports from `shared/rpc-contract/git-params.ts`, which still carries `GitCheckReviewAttributes`.
- `runtime-git-status-commands.ts` — upstream moved local git behind `createLocalGitProvider`
  (`providers/local-git-provider.ts`), so `requireRuntimeGitProvider` always returns a provider.
  `checkRuntimeGitReviewAttributes` now calls the provider, and the local provider gained
  `checkReviewAttributes`.
- `runtime-git-client.ts` — upstream turned the re-exports into `export { … } from`. Took it and
  added `getRuntimeGitReviewAttributes`.
- `preload-runtime-support.ts` — upstream removed the preload's document drop handler (#25748) in
  favour of element owners and a renderer guard. Took the removal; the fork's
  `[data-review-asset-drop]` skip went with it, and `review-asset-drop-claim.ts` (fork fix commit)
  claims drops over the comment boxes instead.
- `NativeChatExperimentalSetting.tsx`, `global-settings-types.ts`, `default-global-settings.ts` —
  upstream dropped `openAgentTabsInChatByDefault`, `experimentalStructuredNativeChat` and the
  Default view select (Chat UI is now one switch). Took upstream's; `openClaudeTabsInWebView` stays,
  and a fork fix commit gives it its own switch (`ClaudeWebDefaultViewSetting.tsx`).
- `SortableTabContextMenu.tsx` — upstream hides "switch into chat view" (only a chat tab gets
  "Switch to terminal view") and adds `TabSessionSurfaceSwitchMenuItems`. Kept the fork's
  `AgentViewSubmenu` plus upstream's new items. `canChat` drops upstream's `isChatView` condition,
  so a terminal tab can still pick Chat UI in place.
- `CommentMarkdown.tsx` — upstream renders block by block (`MemoizedMarkdown` per block) and moved
  component selection to `selectCommentMarkdownComponents`. Wrapped the blocks in the fork's
  `MediaGalleryProvider` and dropped upstream's `expandImages` again (every image expands here).
- `worktree-params.ts` — upstream validates `diffComments` with `DiffCommentSchema`, which strips
  unknown keys; kept `pendingReviewComments`, and a fork fix commit adds `agentAuthor`,
  `githubCommentUrl` and `replyToNoteId` to the schema so agent notes and replies survive.
- Import-only conflicts, kept both sides: `register-app-menu.ts`, `ssh-git-working-tree-provider.ts`,
  `app-api.ts`, `web-app-api.ts`, `main.tsx`, `use-native-chat-context-menu.tsx`,
  `TerminalPaneSurface.tsx`, `use-worktree-card-controller.ts` (`showLinearTitle` beside upstream's
  new Linear context), `WorktreeOpenInMenu.tsx` (the Mod+O shortcut label beside upstream's new
  availability arguments).
- Upstream's Vitest is now 5.x.
- Verify round 1: upstream's `defineMethod` now requires a `permission` (the fork's `agentNote.*` and
  `git.checkReviewAttributes` take `'workspace'`); a new `chat-visual` tab kind broke the exhaustive
  switch in `focus-tab-group-in-direction.ts`; upstream's new `source-control-too-many-changes-banner`
  test omits the fork's `isCategoryFilterActive`, now optional; `web-git-api.ts` and
  `NativeChatResolvedView.tsx` sat at their line caps, so the fork's review-attributes call moved to
  `web-git-review-attributes-api.ts` and the chat View submenu's pane now rides in the portal's
  `contextMenuActions.agentView`; upstream's new "Switch to terminal view" test in
  `SortableTabContextMenu.test.tsx` was rewritten for the View submenu.
- Verify round 2: `pnpm lint` now runs `verify:localization-catalogs` under Bun, so the lint job in
  `fork-verify.yml` installs it too.
- Upstream added two pull-request workflows (`preflight-cli-platforms.yml`,
  `win-orcad-serve-switch-e2e.yml`); they ran once on the sync PR before the disable script could
  see them.

**1.4.214 → 1.4.214** (`2b0ce17514..cc6006779f`, 164 upstream commits, eight conflicts)

- `package.json` still says 1.4.214, so the branch name repeats a fourth time.
- `config/scripts/mobile-web-bundle-packaging-workflow-contract.test.mjs` — upstream deleted it
  (#25791, "Remove low-value test inventories"). Took the deletion, so the fork's two workflow
  entries in it are gone with it; the earlier note about re-adding them no longer applies.
- `DiffCommentPopover.tsx`, `right-panel-comment-composer.tsx` — upstream #25480 swapped their
  `<textarea>` for `ImeTextarea` (IME Enter no longer submits). Both boxes are the fork's
  `ReviewMarkdownComposer` (TipTap), which has no textarea, so kept the fork's files whole.
- `checks-panel/active-content.tsx` — the same #25480 import beside the fork's `useEffect`. Kept both.
- `use-checks-panel-controller-state.tsx` — upstream dropped `panelVisibleSinceRef` /
  `foregroundedUnrenderedReviewKeyRef`; the fork had dropped `commentsRef.current = comments` (the
  comment list comes from `usePRCommentsState`). Dropped both.
- `ui/textarea.tsx` — upstream added a `cell` variant beside the fork's `seamless`. Kept both.
- `lib/worktree-activation.ts` — upstream moved the sidebar-filter lifting into
  `worktree-activation-sidebar-filters.ts` (`liftSidebarFiltersHidingWorktree`). Took the move; the
  fork's `revealTemporaryCheckout(state, wt)` now sits at the end of that function.
- `ui-slice-preference-actions.ts` — upstream moved the agents-view defaults into
  `createAgentsViewPreferenceActions`. Took it and kept the fork's
  `createUiWorkspaceStatusRuleActions` import and spread.
- Localization and RPC catalogs verified clean after the merge; no regeneration was needed.
- Verify round 1: typecheck failed in upstream's own `structured-agent-session-codex-stopped-send-order.test.ts`
  (missing `resolveLaunchArgs`); upstream fixed it one commit later (#25977), so merged again.
- Upstream's Vitest launcher now runs under Bun (`config/bun-version`) and refuses to start without
  it, so `fork-verify.yml` installs it with `oven-sh/setup-bun` before the fork's tests, as
  upstream's `unit-tests.yml` does. Running fork tests locally needs Bun on `PATH` too.
- Upstream added `release-javascript-benchmark.yml`, a pull-request workflow; the disable script
  can only turn it off once it is on GitHub, so it ran once on the sync PR and was cancelled.

**1.4.214 → 1.4.214** (`433986fa3b..2b0ce17514`, 780 upstream commits, ten conflicts)

- `package.json` still says 1.4.214 after 780 commits, so the branch name repeats a third time.
- `src/main/index.ts`, `main-process-ipc-bootstrap.ts` — upstream renamed `os-opened-markdown-files`
  to `os-opened-documents` (`resolveOsOpenedDocuments`, `state.osOpenedDocuments`). Took the rename,
  kept `armForkUpdateChannel` after the capture and every fork import in the bootstrap.
- `updater/updater-download-install.ts` — upstream added `isMacInstallRequested` /
  `setMacInstallPreflightInProgress` to the import. Took it and kept the fork's `app` import; the
  fork's self-install and manual-install early returns auto-merged above upstream's new guards.
- `app-shell/use-app-shell-services.ts` — both sides added a hook import. Kept both.
- `editor/DiffViewer.tsx` — upstream replaced `resolveDocumentTheme(...)` with the
  `useDocumentDarkTheme()` hook (`isDark`), so the theme line is now `editorThemeName(isDark)`
  (`MonacoEditor.tsx` already merged to the same). Upstream also moved the diff editor's dispose
  cleanup into the guarded `modifiedEditor.onDidDispose`; took that and added the fork's
  `setPopover(null)` to it, dropping the fork's old `diffEditor.onDidDispose` copy.
- `editor/rich-markdown-extensions.ts` — upstream reshaped the local-image load into a guarded
  callback. Took it and re-attached the fork's `isGitHubAttachmentAssetUrl` branch after it.
- `right-sidebar/FileExplorerFilesTreePane.tsx` — upstream added imports and went to
  `import type React`. Kept the fork's `React, { useEffect }` (the open-in selection effect) plus
  upstream's new imports.
- `ui/textarea.tsx` — upstream moved variants onto `cva` (`default`, `code`). The fork's `seamless`
  is now a third `cva` variant. Nothing in the renderer passes `seamless` any more (the composers
  became TipTap), so a later sync may drop it.
- `ui-slice-hydration-sanitizers.ts` — both sides appended a function. Kept both.
- `en.json` — took upstream's, then `sync:localization-catalog` re-added the fork's 160 keys,
  identical to main's. That also needs `pnpm run sync:localization-runtime-catalog`: upstream's
  `en-runtime-required.json` did not cover five fork composer keys, and `pnpm lint` stops on it.
- Verify round 1 found four files over the line cap (`DiffViewer.tsx`, `use-global-keybindings.ts`,
  `worktree-activation.ts`, `sidebar-workspace-option-items.ts`): upstream grew each to within a few
  lines of it. The fork's code there now lives in `useDiffViewerCommentPopover.ts`,
  `tab-group-focus/directional-group-focus-chord.ts`, `sidebar/temporary-checkout-reveal.ts` and
  `sidebar/fork-card-property-options.ts`, leaving one-line calls in upstream's files. Upstream's
  `NotesSendMenu` now takes `formatPrompt` and notes shaped like `DiffCommentDeliverySnapshot`, so
  `InlinePRCommentCard` passes a snapshot of the thread's root comment. And
  `web-preload-api-composition.test.ts` had never listed the fork's `settingsTransfer` namespace.
- Upstream's new `DiffViewer.word-wrap-lifecycle.test.tsx` fails on the fork: the fork's
  `useInlinePRCommentActions` needs a `ConfirmationDialogProvider` the test does not mount. Verify
  does not run upstream tests, so it is left as upstream wrote it.
- The Mod+O "open in configured editor" work (`lib/open-in-selection.ts` and its explorer effect) is
  fork work not yet listed in [What this fork owns](#what-this-fork-owns).

**1.4.214 → 1.4.214** (`1554f15b6c..433986fa3b`, 92 upstream commits, no conflicts)

- Upstream's `package.json` did not move: all 92 commits landed under the same 1.4.214, so the
  branch name repeats the previous sync's. `git switch -C` reuses it; the release title still reads
  `(Orca 1.4.214)`.
- The merge was clean. Upstream touched five files the fork also carries (`src/main/index.ts`,
  `config/electron-builder.config.cjs`, `assets/main.css`, `en.json` and
  `SourceControl.virtual-file-list.test.tsx`); git merged each without conflict and upstream's hunks
  went in verbatim. The localization catalog verifies without `--fix`.
- `diff-comment-draft-zone.ts` still falls back to `onLegacyAddCommentClickRef`, so the fork's
  Agent / Comment / Review popover keeps working.
- Upstream changed `virtualized-list.test.tsx`; the fork's `scrollToRowKey` wrapper lives in that
  component, so look there first if Verify fails on it.

**1.4.197 → 1.4.214** (133 upstream commits, three conflicts)

- `src/main/index.ts` — both sides added imports. Keep both; `armForkUpdateChannel` must stay.
- `store/slices/ui/ui-slice-hydration-actions.ts` — upstream moved status-bar migration into its own
  module. Take the move, keep the fork's `hydrateWorkspaceBoardState`.
- `components/editor/DiffViewer.tsx` — **the one that needs judgement.** Upstream #21719 replaced the
  floating add-note popover with an inline draft card (`DiffCommentDraftCard`, opened by
  `diff-comment-draft-zone.ts`) that only makes AI notes. The fork's Agent / Comment / Review choice
  lives in that popover. Resolution: keep the fork's DiffViewer whole — #21719 was upstream's only
  change to it — and do **not** pass `onCreateComment` to `useDiffCommentDecorator`. Upstream's draft
  zone deliberately falls back to `onLegacyAddCommentClickRef` when no `onCreateComment` is given,
  and that fallback is what opens the fork's popover.

  That fallback is load-bearing. If a later sync removes it, the fix is to port the three
  destinations onto `DiffCommentDraftCard` rather than to revert upstream's card.

- The full run found **three fork bugs that every scoped test run had missed**, none caused by the
  merge: the self-updater imported `node:child_process` directly (upstream's import-boundary ratchet
  forbids it — use `spawnProcess` from `src/shared/child-process`); the fork's scroll-by-key wrapper in
  `virtualized-list.tsx` put a `div` between _every_ below-threshold list and its container, breaking
  the artifacts table's ownership of its rows (it is now opt-in via `scrollToRowKey`); and
  `mobile-web-bundle-packaging-workflow-contract.test.mjs` enumerates packaging jobs and did not know
  the fork's two workflows. Scoped runs are fine while building a feature; a full run before a release
  is not optional.
- `mobile-web-bundle-packaging-workflow-contract.test.mjs` lists `fork-preview-release.yml preview`
  and `fork-release.yml build`. If a sync takes upstream's copy of that list, add both back.
- Upstream's `package.json` runs ahead of its releases: it said 1.4.214 while the newest published
  release was 1.4.212, and some versions (1.4.202, 1.4.208) were never published at all. The release
  notes script says so instead of implying notes exist for every version.

## Releasing

`gh workflow run fork-release.yml --repo frbarbre/orca --ref main`, or push a `v*` tag. The workflow builds on a
GitHub-hosted macOS runner and publishes to this fork's releases, which is where the installed app
looks.

**Versions.** The fork keeps its own version line: each release is the previous fork release plus
one patch, unless `-f version=` overrides it. It cannot follow upstream's number, because the
installed app only offers an update whose version is higher than its own, and a sync can land an
upstream number lower than one the fork has already shipped (the first sync took the fork from
1.4.232 onto upstream 1.4.214). The upstream version rides along in the title instead:
**`1.4.233 (Orca 1.4.214)`**, read from `package.json` because that is what the code is.

**Notes.** `config/scripts/fork-release-notes.mjs` writes them in two parts:

- **This fork** — the fork's own commits since the previous release: `git log --no-merges
  <previous-tag>..HEAD --not upstream/main`. Excluding everything reachable from upstream is what
  keeps a sync's hundreds of upstream commits out of this list.
- **Orca** — when `package.json` moved since the previous release, upstream's own release notes for
  every desktop release in that range, newest first, with their headings nested under each version.
  GitHub caps a release body at 125,000 characters and one upstream release alone can run to 43,000,
  so releases that do not fit are listed as links rather than cut off mid-list. When no sync
  happened, it says the release is still based on the same Orca.

On macOS the app now installs the release itself: it downloads the zip, verifies the manifest
checksum, backs up the settings JSON, replaces `/Applications/Orca.app` and relaunches. The previous
version is kept beside it as `Orca.app.previous` until the next update.

Everywhere else it still only notifies and opens the release page, because the bundle swap is a
macOS app-directory move. Installing a DMG by hand also still works; strip quarantine first with
`xattr -dr com.apple.quarantine /Applications/Orca.app`, which is what a browser download sets and
an in-app download does not.

## PR previews

Open a pull request (except a `sync/*` one, which is released straight after Verify) and `fork-preview-release.yml` builds it and publishes a **preview release**,
tagged `preview-pr<N>-<sha>`, linked from a comment on the PR that is edited in place as you push.

A preview installs **beside** your everyday Orca, not over it. `ORCA_PREVIEW_BUILD=1` gives the
build its own bundle id (`com.stablyai.orca.preview`), product name (`Orca Preview`) and URL scheme
— the three things macOS uses to decide whether two bundles are the same app. Consequences worth
knowing before you rely on it:

- It is a **separate app** in `/Applications`, so installing one never replaces the other.
- It keeps **separate settings and workspaces** (Electron derives `userData` from the product
  name). A preview starts unconfigured; it does not inherit the release app's state. That is the
  safe default — two copies sharing one state directory can corrupt it if both run at once.
- Delete `/Applications/Orca Preview.app` when you are done. Nothing cleans previews up for you.

The preview tag is deliberately **not** a version. The updater mines this repo's `releases.atom`
and keeps only tags that parse as a version (`src/shared/app-version.ts`), so `preview-pr12-4a3c18d`
is invisible to an installed release build. It is published as a prerelease too, so it never
becomes `latest`.

Two things to expect:

- `pull_request` workflows run from the **base** branch, so this file has to be on `main` before
  any PR will trigger it.
- A push to a PR cancels the build still running for the previous commit, so a busy branch costs
  one build rather than one per push.
