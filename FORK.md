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
- Every workflow in `.github/workflows/` except `fork-release.yml`.
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

Modified files, and what to re-apply:

| File                                                                                                | What is ours                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/keybindings/types.ts`                                                                   | `editor.previousFile` / `editor.nextFile` in the action union.                                                                                                                                                                                                                                               |
| `src/shared/keybindings/definitions-core-4.ts`                                                      | The two definitions. **These files have a 300-line ESLint cap** — if upstream has grown this one, move ours to whichever `definitions-core-*.ts` has room.                                                                                                                                                   |
| `src/renderer/src/components/editor/editor-shortcuts.ts`                                            | `installChangedFileNavigationShortcut`, including the `beginChangedFileHold` call on a fresh press. `installMonacoDiffChangeNavigationShortcut` stays upstream's.                                                                                                                                            |
| `src/renderer/src/components/editor/diff-navigation-context.tsx`                                    | The file-nav listener, installed and torn down on the same seam as the change-nav one. The change-nav shortcut is handed an adapter whose `goToDiff` is `goToDiffWithoutWrap`, and the header buttons call `goToDiffWithoutWrap` too — this is what stops Monaco wrapping from the last change to the first. |
| `src/renderer/.../store/slices/editor/types/editor-files-slice.ts`                                  | `stepToChangedFile` and its `options?: ChangedFileStepOptions` (`wrap: false` for a held chord).                                                                                                                                                                                                             |
| `src/renderer/src/components/editor/DiffViewer.tsx`                                                 | `useDiffViewerPendingRevealScroll` + the `hasPendingReveal` argument.                                                                                                                                                                                                                                        |
| `src/renderer/src/components/editor/useDiffViewerFirstChangeAutoScroll.ts`                          | The `hasPendingReveal` input that makes the auto-scroll stand down.                                                                                                                                                                                                                                          |
| `src/renderer/src/components/editor/monaco-reveal.ts`, `use-monaco-reveal-scheduler.ts`             | Type widened from `IStandaloneCodeEditor` to `ICodeEditor` so the diff editor can reuse the scheduler.                                                                                                                                                                                                       |
| `src/renderer/src/components/virtualized-list.tsx`                                                  | `scrollToRowKey`, `alignRowWithinScrollPadding`, and the flow-path wrapper — rendered **only when a caller passes `scrollToRowKey`**, so every other list keeps upstream's bare fragment. Heavily edited — merge with care.                                                                                                                                                                                                    |
| `src/renderer/.../checks-panel/comment-row.tsx`, `comment-group.tsx`, `use-comments-list-state.tsx` | The `onOpenLocation` prop and the clickable path badge.                                                                                                                                                                                                                                                      |
| `src/renderer/.../source-control/listing/*`                                                         | `activeOpenRowKey`, the branch-row `isOpenFile` highlight, the published review order in `use-file-listing.ts`.                                                                                                                                                                                              |
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

A second, simpler rule lives beside it: **a column per remote server**. Every workspace on a mapped
server (`statusByHost`, keyed by execution host id such as `runtime:<environment id>`) is kept in
that column, whatever project it is in and whether or not the pull request rules are on. For those
workspaces it wins: the pull request collector skips them, so the two never move a workspace back
and forth.

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
- `src/shared/workspace-host-status-plan.ts` (+ test) — pure planner for the per-server column.
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
  `pull-request-status-rule-copy.ts`, `RemoteHostStatusRulesSection.tsx` (+ test)
- `src/renderer/src/store/slices/ui/ui-slice-workspace-status-rule-actions.ts`
- `src/renderer/src/web/preload-api/web-review-status-rules-api.ts`

Modified files, and what to re-apply:

| File                                                                            | What is ours                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/persisted-ui-state-types.ts`                                        | `workspaceStatusRules?: WorkspaceStatusRuleConfig` and its import.                                                                                                                                                |
| `src/shared/rpc-contract/client-ui-params.ts`                                   | `workspaceStatusRules: WorkspaceStatusRules.optional()` and its import.                                                                                                                                           |
| `src/main/persistence/loading-store/normalize-loaded-ui-state.ts`               | One `normalizeWorkspaceStatusRuleConfig(...)` line in the returned object.                                                                                                                                        |
| `src/main/persistence/applying-settings/ui-state-read.ts`, `ui-state-update.ts` | One normalize line each, beside `workspaceStatuses`.                                                                                                                                                              |
| `src/main/startup/main-process-ipc-bootstrap.ts`                                | The `review-status-rules:snapshot` handler.                                                                                                                                                                       |
| `src/preload/api-types.ts`, `src/preload/index.ts`                              | The `reviewStatusRules` member.                                                                                                                                                                                   |
| `src/renderer/src/web/web-preload-api.ts`                                       | `...createWebReviewStatusRulesApi()`.                                                                                                                                                                             |
| `src/renderer/src/store/slices/ui/ui-slice-contract-preferences.ts`             | The three `workspaceStatusRules` members.                                                                                                                                                                         |
| `src/renderer/src/store/slices/ui/ui-slice-hydration-actions.ts`                | One normalize line.                                                                                                                                                                                               |
| `src/renderer/src/store/slices/ui/ui-slice-preference-actions.ts`               | `...createUiWorkspaceStatusRuleActions(set, get)` as the first spread. **Deliberately not `ui.ts`** — inserting a line there drags upstream's pre-existing `as UISlice` cast into the changed-lines quality gate. |
| `src/renderer/src/components/settings/AutomationsSettingsPane.tsx`              | `<PullRequestStatusRulesSection />` and `<RemoteHostStatusRulesSection />`.                                                                                                                                       |

Two upstream **test** files carry our additions. Take upstream's version, then re-apply:

- `web-preload-api-composition.test.ts` — `'reviewStatusRules'` in the expected namespace list.
- `AutomationsSettingsPane.test.tsx` — the store mock needs `workspaceStatusRules`,
  `workspaceStatuses`, `repos` and `setWorkspaceStatusRules`, plus the host-option inputs
  `sshTargetLabels`, `sshConnectionStates`, `settings`, `runtimeEnvironments` and
  `runtimeStatusByEnvironmentId`.

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

## Verify

Run all of these. The first three are the gates upstream's CI uses; the fourth is the fork's.

```bash
pnpm lint
pnpm typecheck
pnpm test
./config/scripts/test-fork-features.sh
```

`test-fork-features.sh` runs every test file a fork commit touched — derived from git, not listed,
because a commit reachable from `upstream/main` is upstream's and everything else is ours. A fork
change that adds a test is covered by it automatically. Run it on its own as well as inside
`pnpm test`: it is the one check whose failures are always the fork's problem, where a full run
buries them among upstream's environmental failures.

Run the **full** `pnpm lint`, not just `pnpm run check:code-quality:changed`. The per-change gate is
what keeps day-to-day commits clean, but it reports warnings without denying them and skips the
localization checks entirely — the first sync found three gaps it had let through.

Then confirm the fork channel actually survived the merge — a clean test run does **not** prove
this, because the defaults are upstream's on purpose:

```bash
# Each must print a match. A miss means the update channel was lost in the merge.
grep -n "armForkUpdateChannel" src/main/index.ts
grep -n "ORCA_RELEASES_REPO_URL" src/main/updater-prerelease-feed.ts
grep -n "ORCA_UPDATE_FEED_URL" src/main/updater/updater-setup.ts src/main/updater/updater-release-feed.ts
grep -n "isManualInstallOnlyUpdate" src/main/updater/updater-download-install.ts
grep -n "isForkSelfInstallUpdate" src/main/updater/updater-download-install.ts
grep -n "frbarbre" config/electron-builder.config.cjs
```

If `pnpm test` reports failures, check whether they also fail on upstream before assuming the merge
caused them — stash the merge and re-run the failing files. **Compare against a clean upstream checkout, not a stash** — stashing only
removes uncommitted work and leaves every fork commit in place, which is how a fork bug got filed as
"environmental" here once. A worktree sharing `node_modules` is quick:

```bash
git worktree add --detach /tmp/orca-up upstream/main
ln -s "$PWD/node_modules" /tmp/orca-up/node_modules
(cd /tmp/orca-up && npx vitest run --config config/vitest.config.ts <failing files>)
```

On this machine a clean upstream checkout consistently fails `skill-recipe-shell`,
`browser-manager-viewport-ownership`, the PTY-settle tests, the real-CLI Claude tests,
`build-native-for-platform` and the `tests/e2e/cross-version-wire/*` suite (which materializes release
checkouts). `pty-runtime-hidden-at-spawn-mark` and `session-scanner-service-search` flake under
full-suite load and pass alone. `e2e-worker-env-isolation` fails only because the cross-version suite
leaves a `.cross-version-checkouts/` cache inside the repo; `rm -rf .cross-version-checkouts` clears it.

`test-fork-features.sh` fetches `upstream/main`, so upstream can move **during** a sync. Before
blaming the merge for a failure, check whether upstream fixed it after the merge point — the first
sync hit exactly that (#23062 landed two commits later) and was fixed by merging again.

### Sync log

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

Open a pull request and `fork-preview-release.yml` builds it and publishes a **preview release**,
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
