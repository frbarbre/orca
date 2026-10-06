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

| File                                           | What is ours                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main/updater/updater-manual-install.ts`   | Whole file (new). `armForkUpdateChannel` + the manual-install helpers.                                                                                                                           |
| `src/main/index.ts`                            | The `armForkUpdateChannel(app.isPackaged)` call and its import. If upstream restructures startup, move the call — keep it before any updater setup runs.                                         |
| `src/main/updater/updater-setup.ts`            | `ORCA_UPDATE_FEED_URL ??` on the feed URL, and the `!isManualInstallOnlyUpdate()` term in `autoInstallOnAppQuit`.                                                                                |
| `src/main/updater/updater-release-feed.ts`     | `ORCA_UPDATE_FEED_URL ??` on the fallback feed URL.                                                                                                                                              |
| `src/main/updater-prerelease-feed.ts`          | `repoBase()` / `atomFeedUrl()` / `releasesDownloadBase()` / `tagHrefPattern()` and the regexes derived from them. Upstream hardcodes the slug; keep it derived, and keep these as **functions**. |
| `src/main/updater/updater-download-install.ts` | The `isManualInstallOnlyUpdate()` early return at the top of `downloadUpdate` and `quitAndInstall`.                                                                                              |
| `config/electron-builder.config.cjs`           | `owner: process.env.ORCA_PUBLISH_OWNER ?? 'frbarbre'` and `releaseType: … : 'release'`.                                                                                                          |
| `.github/workflows/fork-release.yml`           | Whole file (new).                                                                                                                                                                                |
| `config/scripts/fork-release-notes.mjs` (+ test) | Whole file (new). Resolves the fork version and writes the two-part release notes. |
| `config/scripts/test-fork-features.sh` | Whole file (new). Runs every test a fork commit touched; part of [Verify](#verify). |
| `.github/workflows/fork-verify.yml` | Whole file (new). [Verify](#verify) on pull requests. |
| `config/scripts/fork-disable-upstream-pr-workflows.mjs` | Whole file (new). Keeps upstream's pull-request workflows disabled on this repository. |
| `src/shared/release-channel.ts` | `setMainReleaseRepoOverride` and the `mainReleaseRepo()` it feeds. `MAIN_RELEASE_REPO` itself stays upstream's — same rule as the updater URLs. |
| `src/renderer/src/main.tsx` | Arms that override from `VITE_ORCA_RELEASES_REPO`. The renderer cannot read the main process's env, so release-notes links there resolved to upstream's repo — a 404 for every fork-only version. |

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
  *downloader*, not by the act of downloading; a file written by Node gets only
  `com.apple.provenance`, which Gatekeeper does not act on. The script still strips quarantine
  defensively.
- **`codesign -v` cannot be the gate.** It fails on a perfectly good install of this fork — "code
  has no resources but signature indicates they must be present" — because the bundles are ad-hoc
  signed without sealed resources. Integrity is the manifest's **sha512**, checked before anything
  is swapped; the script then only checks that the archive expanded into something launchable.

The swap moves the old bundle to `Orca.app.previous` rather than deleting it, so a failed install is
one `mv` from recovery, and every failure path relaunches the version that is still installed.
`ditto` does the expanding, not `unzip`, which does not preserve bundle symlinks or permissions.

| File | What is ours |
| --- | --- |
| `src/main/updater/fork-install/*` (+ tests) | Whole directory (new): manifest parsing, the checksum-gated download, the settings backup, the swap script and the orchestrator. |
| `src/main/updater/updater-manual-install.ts` | Arms `ORCA_UPDATE_SELF_INSTALL` on macOS. |
| `src/main/updater/updater-download-install.ts` | The self-install branch of `downloadUpdate`, and the early return in `quitAndInstall`. |

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

| File                                                                                                | What is ours                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/keybindings/types.ts`                                                                   | `editor.previousFile` / `editor.nextFile` in the action union.                                                                                                                                                                                                                                               |
| `src/shared/keybindings/definitions-core-4.ts`                                                      | The two definitions. **These files have a 300-line ESLint cap** — if upstream has grown this one, move ours to whichever `definitions-core-*.ts` has room.                                                                                                                                                   |
| `src/renderer/src/components/editor/editor-shortcuts.ts`                                            | `installChangedFileNavigationShortcut`, including the `beginChangedFileHold` call on a fresh press. `installMonacoDiffChangeNavigationShortcut` stays upstream's.                                                                                                                                            |
| `src/renderer/src/components/editor/diff-navigation-context.tsx`                                    | The file-nav listener and the `registerDiffEditorForOutsideShortcuts` registration, installed and torn down on the same seam as the change-nav one. The change-nav shortcut is handed an adapter whose `goToDiff` is `goToDiffWithoutWrap`, and the header buttons call `goToDiffWithoutWrap` too — this is what stops Monaco wrapping from the last change to the first. |
| `src/renderer/.../store/slices/editor/types/editor-files-slice.ts`                                  | `stepToChangedFile` and its `options?: ChangedFileStepOptions` (`wrap: false` for a held chord).                                                                                                                                                                                                             |
| `src/renderer/src/components/editor/DiffViewer.tsx`                                                 | `useDiffViewerPendingRevealScroll` + the `hasPendingReveal` argument.                                                                                                                                          |
| `src/renderer/src/components/terminal-workspace-editor-shortcuts.ts`                                | The `handleDiffShortcutOutsideEditor` call at the top of `handleTerminalWorkspaceEditorShortcut`.                                                                                                                                                                                                            |
| `src/renderer/src/components/editor/useDiffViewerFirstChangeAutoScroll.ts`                          | The `hasPendingReveal` input that makes the auto-scroll stand down.                                                                                                                                                                                                                                          |
| `src/renderer/src/components/editor/monaco-reveal.ts`, `use-monaco-reveal-scheduler.ts`             | Type widened from `IStandaloneCodeEditor` to `ICodeEditor` so the diff editor can reuse the scheduler.                                                                                                                                                                                                       |
| `src/renderer/src/components/virtualized-list.tsx`                                                  | `scrollToRowKey`, `alignRowWithinScrollPadding`, and the flow-path wrapper — rendered **only when a caller passes `scrollToRowKey`**, so every other list keeps upstream's bare fragment. Heavily edited — merge with care.                                                                                                                                                                                                    |
| `src/renderer/.../checks-panel/comment-row.tsx`, `comment-group.tsx`, `use-comments-list-state.tsx` | The `onOpenLocation` prop and the clickable path badge.                                                                                                                                                                                                                                                      |
| `src/renderer/.../source-control/listing/*`                                                         | `activeOpenRowKey`, the branch-row `isOpenFile` highlight, the published review order in `use-published-review-order.ts`.                                                                                                                                                                                              |
| `src/renderer/.../source-control/panel/panel-ready.tsx`                                             | `scroll-pb-9` on the file-list scroller — reserves the sticky Commits header.                                                                                                                                                                                                                                |
| `src/renderer/.../listing/active-open-file-keys.ts`                                                 | The `branch::<path>` key. Branch keys **must bypass** the availability filter.                                                                                                                                                                                                                               |

Four upstream **test** files carry our additions. Take upstream's version, then re-apply:

- `source-control-active-open-file-keys.test.ts` — the branch-key tests.
- `source-control-branch-section-heading.test.tsx`, `section-action-buttons.test.tsx` —
  `activeOpenRowKeys` / `activeOpenRowKey` props on the branch section.
- `diff-navigation-context.test.tsx` — the fake editor's `getModifiedEditor` and line-numbered
  `getLineChanges` (no-wrap stepping reads both), plus the "does not wrap" test.

### 3. Pull-request-driven workspace statuses

Watches each workspace's linked pull request and sets its board column, deletes the workspace once
its pull request is merged or closed, and opens a review workspace when someone asks you to review.
Configured per project under Settings → Automations.

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
| `src/renderer/.../source-control/sync/use-base-refs.ts`                         | `useIsReviewedCommit(normalizedWorktreeBaseRef)` and the `compareBaseRef` line that prefers a pinned reviewed commit. The PR/rebase target (`effectiveBaseRef`) stays upstream's.                                   |
| `src/main/git/source-control/branch-compare.ts`                                 | `isReviewBaseRef(baseRef) ? baseOid : resolveMergeBase(...)` — a review base is an exact base. Every diff consumer reads `summary.mergeBase`, so the file diffs follow.                                       |
| `src/main/startup/main-process-ipc-bootstrap.ts`                                | The `review-status-rules:snapshot` handler, and `pending-review:resolve-base` (registered-path check first).                                                                                                                                                                       |
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
- `hostedReview` already means *the pull request itself* in this codebase, so this feature is named
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

| File | What is ours |
| --- | --- |
| `src/shared/worktree/types.ts`, `meta-types.ts`, `rpc-contract/worktree-params.ts` | `pendingReviewComments` beside `diffComments`. |
| `ipc/worktree-metadata-merge.ts`, `ipc/worktrees/folder-workspace-model.ts`, `runtime/runtime-folder-workspace.ts` | `pendingReviewComments` forwarded out of persisted metadata. **Every one of these has to list the field by name**: they rebuild the renderer's `Worktree` field by field, so one that is left out is written on every change and then dropped on the next launch, with nothing failing in between. Now read only to adopt drafts written before they moved onto the device. |
| `src/main/github/pending-review-draft-store.ts` (+ test), `components/pending-review/pending-review-draft-store.ts` (+ test) | New. The device-local queue: the file, and the renderer store that keeps an edit made before the first load finishes. Reached through `pending-review:drafts-read` / `-write` on the fork's own IPC surface, so no upstream persistence code is touched. |
| `DiffCommentPopover.tsx` | `DiffCommentMode` gains `'pending'`, the third radio, and the relabelled `'review'` button ("Comment now"). |
| `DiffLineCommentPopoverHost.tsx` | The `onQueueForReview` prop and the third submit arm. |
| `use-diff-review-comment.ts` | `resolveMode` falls back for any non-note mode, not only `'review'`. |
| `inline-pr-comment-placement.ts` (+ test) | The placement union gains `kind`, and pending drafts are placed alongside threads. |
| `useInlinePRCommentZones.tsx` | The `pendingReview` input and the pending branch in `renderZone`. |
| `editor/DiffViewer.tsx` | The queue hook, `onQueueForReview`, and passing the queue to the zones. |
| `source-control/panel/panel-ready.tsx` | The shelf, hidden at zero drafts like the notes shelf. |
| `source-control/listing/section-header.tsx` | An optional `className`, so the pending-review section can reuse the changed-file section header with its own spacing. |
| `src/preload/api-types.ts`, `index.ts`, `web/web-preload-api.ts` | The `pendingReview` member. |
| `src/renderer/src/components/ui/textarea.tsx` | The `seamless` variant, so a composer can own the border and put its actions inside the same box. Added as a primitive variant because the design-system lint refuses that restyle at the call site. |
| `checks-panel/comments-list.tsx` | `<PendingReviewPanelSection />` above the list. |
| `tab-bar/EditorFileTab.tsx` (+ its test's stub) | The per-file pending badge beside the unresolved-thread one. |
| `source-control/listing/*`, `panel/panel-content.tsx` | `pendingReviewCountByPath` threaded to the file rows, mirroring `reviewThreadCountByPath`. |
| `src/main/startup/main-process-ipc-bootstrap.ts` | The `pending-review:submit` and `pending-review:context` handlers. |
| `src/renderer/src/components/ui/button.tsx` | The `ghost-destructive` variant. |
| `src/renderer/src/components/ui/textarea.tsx` | The `seamless` variant. |
| `src/renderer/src/lib/pr-comment-action-state.ts` | The `'pending'` state. |
| `right-sidebar/pr-comment-presentation.ts` | `statusBadgePending` and `commentEditorText` (the editor used to hardcode a size, so editing shrank the text). |
| `checks-panel/comment-controls.tsx` | The Pending branch of `PRCommentActionBadge`. |
| `checks-panel/comment-row.tsx` | `forceMutable`, and the editor taking its type scale from the presentation. |
| `checks-panel/comment-editor.tsx` | New. The body editor, lifted out because the row hit its 400-line cap. It grows to fit the draft up to 240px, then scrolls, and takes mod+Enter as submit (plain Enter is a newline — a comment is prose). |
| `diff-comments/DiffCommentPopover.tsx` | `MODE_OPTIONS` and the segmented Agent/Comment/Review control. |
| `diff-comments/use-diff-review-comment.ts` | Commentable lines seeded synchronously and `null` until known, so the popover does not open on the wrong destination and switch a frame later. |
| `diff-comments/diff-comment-zone-mouse-events.ts`, `useInlinePRCommentZones.tsx` | `installDiffCommentZoneKeyStopper`, so a keystroke typed in a zone card does not also drive the editor. |
| `editor/editor-shortcuts.ts` | The typing-target guard on both diff navigation shortcuts. |

#### The diff base: since last review, or the whole pull request

A segmented control in the review shelf switches the workspace's `baseRef` between the commit the
viewer last reviewed (`viewerLatestReview.commit.oid`, free on the context query the banner already
makes) and `refs/remotes/origin/<base>`. The whole pull request is always the other tab rather than
an error path, because a force-push can strip the reviewed commit off the remote.

Before offering the tab, `use-commit-resolves.ts` probes the commit with the same branch compare the
diff itself would run. Note that git resolves a well-formed sha naming no object, so a force-pushed
commit comes back as **`no-merge-base`**, not `invalid-base` — `commit-resolution.ts` treats both as
missing, and that mapping is the thing to keep if this is ever rewritten.

| File | What is ours |
| --- | --- |
| `src/renderer/src/components/ui/segmented-tabs.tsx` | New. The Agent/Comment/Review control lifted out of `DiffCommentPopover` so the shelf can reuse it, plus `fullWidth`. |
| `src/renderer/src/components/pending-review/use-review-diff-base.ts`, `use-commit-resolves.ts`, `commit-resolution.ts` (+ test) | New. The base switch and the reachability probe. |
| `src/main/github/review-verdict-mutation.ts`, `submit-review-verdict.ts`, `pending-review-api.ts` | `viewerLatestReview { commit { oid } }` and `baseRefName` on the context query. |
| `source-control/panel/branch-context-row.tsx` | A min height on the HEAD line. The line-total chip unmounts while a new base compares and the row is a hair taller with it, so the panel jumped on every switch. |


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

| File | What is ours |
| --- | --- |
| `src/main/github/update-published-comment.ts` | New. The `updatePullRequestReviewComment` mutation. |
| `src/renderer/src/components/pending-review/editable-published-comment.ts` (+ test) | New. The `viewerCanUpdate` gate. |
| `src/main/github/client/fetch/pr-review-threads-query.ts` | `lastEditedAt` and `viewerCanUpdate` on all three comment selections. |
| `src/main/github/client/fetch/get-pr-comments.ts`, `src/shared/github/comment-types.ts` | Those two fields mapped onto `PRComment`. |
| `checks-panel/comment-row.tsx` | `canEditComment` beside `canMutateComment`, and the `(edited)` marker in both layouts. |
| `checks-panel/use-checks-panel-comment-mutations.tsx` | The inline branch of `handleEditComment`. |
| `src/renderer/src/web/web-preload-api-composition.test.ts` | `pendingReview` added to the enumerated web surface — the review-mode merge left this red. |

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

| File | What is ours |
| --- | --- |
| `src/shared/workspace-status-rules.ts` (+ test) | `readViewerReviewStanding`. |
| `src/shared/workspace-status-rule-plan.ts` (+ test) | The reviewed-removal arm, `forgetHandledKey`, and `sinceReviewCommit` on a creation. |
| `src/shared/workspace-status-rule-config.ts` | `onReviewed`. |
| `review-status-snapshot-query.ts`, `-mapping.ts`, `review-status-snapshot-types.ts` | `commit { oid }` on `latestReviews`. |
| `workspace-status-rules/apply-workspace-status-rule-plan.ts`, `create-review-workspace.ts`, `collect-workspace-status-rule-targets.ts` | Forgetting the key after a removal lands, the re-clone base, and the pending-comment guard. |
| `store/slices/ui/ui-slice-workspace-status-rule-actions.ts` + its contract | `forgetPullRequestHandled`. |
| `settings/PullRequestStatusRulesSection.tsx` | The toggle, and the second prompt box. |
| `src/shared/workspace-status-rule-prompt.ts` (+ test) | `{{sinceCommit}}`, which falls back to the base branch so a first-look prompt never shows a raw placeholder. |

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

| File | What is ours |
| --- | --- |
| `src/shared/github/pull-request-reviewers.ts` (+ test) | `buildPullRequestReviewers`. |
| `src/main/github/review-verdict-mutation.ts`, `submit-review-verdict.ts` | Reviewer fields on the facts query, and their parsing. |
| `pending-review/use-submit-review-verdict.ts` | `reviewers` and `rerequest`, through `gh.requestPRReviewers`. |
| `source-control/pending-review/pending-review-reviewers.tsx` (+ test) | The list. |

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

| File | What is ours |
| --- | --- |
| `src/shared/keybindings/definitions-group-direction.ts`, `directional-group-focus.ts` | The four actions and their matcher. |
| `src/renderer/src/lib/tab-group-focus/` (+ tests) | `findRectInDirection` and `focusTabGroupInDirection`. |
| `src/main/window/main-window-shortcut-routing.ts` | Yielding the chord to the renderer. |
| `app-shell/use-global-keybindings.ts` | Running the move, and the single-group history fallback. |

### 7. Linear title on workspace cards

Card display → "Linear title" adds the linked Linear issue's title as a line under the card's
branch row. Off by default. It reuses the card's existing Linear fetch, which now also runs when
only the title is shown.

| File | What is ours |
| --- | --- |
| `src/shared/ui-chrome-types.ts`, `src/shared/worktree/card-properties.ts` | `'linear-title'` in the union and in `WORKTREE_CARD_PROPERTIES`. |
| `sidebar/sidebar-workspace-option-items.ts` | The menu option. |
| `sidebar/use-worktree-card-controller.ts` | `showLinearTitle`, and fetching for it. |
| `sidebar/worktree-card-parent-content.tsx`, `worktree-card-linear-title.tsx` (+ test) | The row. |

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

### 9. Sidebar: hide temporary checkouts, and Run on a shortcut

"Hide temporary checkouts" hides worktrees under `/tmp`, `/private/tmp`, `/var/folders` or
`AppData\Local\Temp` (agents' scratch `git worktree add`s). It is threaded beside
`hideDetachedHeadWorkspaces` everywhere that flag goes, except the jump palette, whose file sits at
its line cap. The listing reads it from the store rather than `filterState`, so upstream's
filter-state types and tests stay as they are. `persisted-ui-write-baseline.test.ts` gains the
field in its census fixture — re-apply after taking upstream's version.

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

The preload's document-level file-drop handler skips `[data-review-asset-drop]` elements
(`preload-runtime-support.ts`) so these boxes receive the File objects.

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
- **UI**: an allowlist of preferences — board columns, sidebar grouping and filters, card
  properties, status bar, zoom — and the status rules minus `repoIds`, the handled-PR ledger and
  `newWorkspaceStatusSince`.
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

| File | What is ours |
| --- | --- |
| `src/main/ipc/filesystem.ts` | The `registerFilesystemGitReviewAttributesHandlers` call. |
| `src/main/providers/git-provider-contract.ts`, `ssh-git-working-tree-provider.ts` | `checkReviewAttributes`. |
| `src/main/runtime/runtime-git-status-commands.ts`, `orca-runtime-git.ts`, `runtime-git-command-surface.ts`, `rpc/methods/git.ts`, `rpc/methods/git-params.ts`, `runtime-git-api-contract.test.ts` | `checkRuntimeGitReviewAttributes` and the `git.checkReviewAttributes` method. |
| `src/shared/rpc-contract/git-params.ts` | `GitCheckReviewAttributes`; regenerate the catalog with `pnpm run generate:rpc-params-catalog`. |
| `src/relay/git-handler-read-operations.ts`, `git-handler-registration.ts` | `checkReviewAttributes` and its registration. |
| `src/preload/api/git-bridge.ts`, `git-inspection-api.ts`, `src/renderer/src/web/preload-api/web-git-api.ts` | `checkReviewAttributes`. |
| `src/renderer/src/runtime/runtime-git-status-client.ts`, `runtime-git-client.ts` | `getRuntimeGitReviewAttributes`. |
| `source-control/panel/use-panel-view-state.ts` | `hiddenFileCategories` / `toggleFileCategory`, deliberately not reset on worktree switch. |
| `source-control/panel/use-panel-foundation.ts`, `listing/use-file-listing.ts` | Passing `hiddenFileCategories` and `reviewAttributes` into the projection. |
| `source-control/listing/use-file-projection.ts` | `categoryGrouped` feeds both the text filter and `unfilteredDisplaySectionsById`, so section Stage all / Discard all / View all never act on hidden files. Branch entries are category-filtered before the text filter. |
| `source-control/panel/panel-content.tsx`, `listing/content-status.tsx` | The filter under the commit surface and the "All changed files are hidden" empty state. |

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
Local sessions only: an SSH workspace's file lives on the remote host and is not read.

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

New files: `src/shared/claude-remote-session.ts`, `src/main/claude/claude-remote-session-url.ts`
(+ test), `src/main/claude/claude-web-guest-shortcuts.ts` (+ test), `src/main/menu/app-menu-paste-item.ts`, `src/main/ipc/claude-remote-session.ts`, `src/preload/api/claude-remote-session-bridge.ts`,
and in `src/renderer/src/components/terminal-pane/`: `claude-web-view-state.ts` (+ test),
`ClaudeWebView.tsx`, `AgentViewSubmenu.tsx`, `agent-view-choice.ts` (+ test),
`claude-remote-session-poll.ts` (+ test), `claude-web-key-replay.ts`, `use-claude-web-auto-open.ts`,
`TerminalPaneClaudeWebPortal.tsx`; plus `tests/e2e/claude-web-view.spec.ts`.

| File | What is ours |
| --- | --- |
| `src/main/ipc/register-core-handlers/register-core-handlers.ts` | `registerClaudeRemoteSessionHandlers(() => store.getSettings().keybindings)`. |
| `src/main/menu/register-app-menu.ts` (+ test) | The Paste item comes from `createAppMenuPasteItem` (new `app-menu-paste-item.ts`, which also holds upstream's paste routing); the test's "pastes natively into a focused guest webview" case. |
| `src/preload/api-types.ts`, `src/preload/index.ts` | `claudeRemoteSession`. |
| `src/shared/global-settings-types.ts`, `default-global-settings.ts` | `openClaudeTabsInWebView`. |
| `src/renderer/src/components/settings/NativeChatExperimentalSetting.tsx` | The Claude web option of Default view. |
| `src/renderer/src/components/terminal-pane/TerminalPaneSurface.tsx` | `<TerminalPaneClaudeWebPortal>`, the `claudeWebTabId` / `claudeWebLeafId` props and `webViewLeafId`. |
| `src/renderer/src/components/terminal-pane/TerminalPaneHeaderOverlay.tsx` | The optional `webViewLeafId` prop and its single-pane early return. |
| `src/renderer/src/components/terminal-pane/TerminalContextMenu.tsx` | The optional `claudeWeb*` props; `<AgentViewSubmenu>` replaces upstream's chat toggle when the tab is known. |
| `src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx` | `<AgentViewSubmenu>` replaces upstream's "Switch to chat/terminal view" item. |
| `src/renderer/src/components/native-chat/use-native-chat-context-menu.tsx` (+ test), `NativeChatResolvedView.tsx` | The optional `agentView` argument: a terminal-backed chat's right-click menu shows `<AgentViewSubmenu>` instead of "Switch to terminal view". Structured chats keep their menu. |
| `SortableTabContextMenu.test.tsx`, `SortableTab.rename-shortcut.test.tsx`, `register-core-handlers.test.ts` | Store fields / module mocks for the above; re-apply after taking upstream's test. |

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
grep -n "ORCA_RELEASES_REPO_URL" src/main/updater-prerelease-feed.ts
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
  `virtualized-list.tsx` put a `div` between *every* below-threshold list and its container, breaking
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
