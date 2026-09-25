# Fork guidance

This is a fork of `stablyai/orca`. It carries a small, deliberate set of changes on top of upstream
and is otherwise meant to stay identical to it.

**Read this before resolving any merge conflict from upstream.** The default answer is "take
upstream". Only the changes listed in [What this fork owns](#what-this-fork-owns) are ours to keep,
and each one says how to re-apply it if upstream has moved the code underneath it.

## The merge

```bash
git remote add upstream https://github.com/stablyai/orca.git   # once
git fetch upstream
git merge upstream/main
```

Resolve conflicts with the rules below, then run [Verify](#verify) before pushing. Never push a
merge that has not been verified — a broken `main` here produces a broken release, and the release
is the only way this fork reaches the machine it runs on.

## Upstream is the source of truth

For anything not listed in the next section, take upstream's side outright. In particular, resolve
these with `git checkout --theirs` without reading the diff:

- `package.json` and `pnpm-lock.yaml`, including the `version` field. The fork never sets its own
  version; releases are cut at whatever version upstream is on.
- `src/i18n/locales/**` and any other generated or extracted file.
- Every workflow in `.github/workflows/` except `fork-release.yml`.
- `docs/**`, and every test file except the three named below.
- Any file where our only "change" is formatting from a pre-commit hook.

If a conflict is in a file this document does not mention, that is the answer: take upstream's.

## What this fork owns

Two groups. The updater group is what makes this fork a distinct app that updates from its own
releases — losing it silently turns the fork back into stock Orca on the next update check. The
editor group is the feature work.

### 1. Fork update channel — keep, and check carefully

**Rule: keep the indirection, keep upstream's default.** This is the one thing most likely to be
resolved wrongly, because the natural instinct is to "fix" the defaults to point at this fork.

Every release URL in the updater reads an env var and **falls back to upstream's URL**:

```ts
const REPO_BASE = process.env.ORCA_RELEASES_REPO_URL ?? 'https://github.com/stablyai/orca'
```

That default must stay `stablyai`. The fork is selected at runtime by `armForkUpdateChannel()`,
which sets the env vars for packaged builds only. Keeping the defaults upstream is what lets every
updater module and all 330 of its tests stay exactly as upstream wrote them. Re-pointing the
literals instead means editing nine test files and re-resolving them on every single merge.

| File | What is ours |
| --- | --- |
| `src/main/updater/updater-manual-install.ts` | Whole file (new). `armForkUpdateChannel` + the manual-install helpers. |
| `src/main/index.ts` | The `armForkUpdateChannel(app.isPackaged)` call and its import. If upstream restructures startup, move the call — keep it before any updater setup runs. |
| `src/main/updater/updater-setup.ts` | `ORCA_UPDATE_FEED_URL ??` on the feed URL, and the `!isManualInstallOnlyUpdate()` term in `autoInstallOnAppQuit`. |
| `src/main/updater/updater-release-feed.ts` | `ORCA_UPDATE_FEED_URL ??` on the fallback feed URL. |
| `src/main/updater-prerelease-feed.ts` | `REPO_BASE` and the regexes derived from it (`TAG_HREF_RE`, the release-asset test). Upstream hardcodes the slug in those regexes; keep them derived. |
| `src/main/updater/updater-download-install.ts` | The `isManualInstallOnlyUpdate()` early return at the top of `downloadUpdate` and `quitAndInstall`. |
| `config/electron-builder.config.cjs` | `owner: process.env.ORCA_PUBLISH_OWNER ?? 'frbarbre'` and `releaseType: … : 'release'`. |
| `.github/workflows/fork-release.yml` | Whole file (new). |

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

Modified files, and what to re-apply:

| File | What is ours |
| --- | --- |
| `src/shared/keybindings/types.ts` | `editor.previousFile` / `editor.nextFile` in the action union. |
| `src/shared/keybindings/definitions-core-4.ts` | The two definitions. **These files have a 300-line ESLint cap** — if upstream has grown this one, move ours to whichever `definitions-core-*.ts` has room. |
| `src/renderer/src/components/editor/editor-shortcuts.ts` | `installChangedFileNavigationShortcut`. |
| `src/renderer/src/components/editor/diff-navigation-context.tsx` | The file-nav listener, installed and torn down on the same seam as the change-nav one. |
| `src/renderer/src/components/editor/DiffViewer.tsx` | `useDiffViewerPendingRevealScroll` + the `hasPendingReveal` argument. |
| `src/renderer/src/components/editor/useDiffViewerFirstChangeAutoScroll.ts` | The `hasPendingReveal` input that makes the auto-scroll stand down. |
| `src/renderer/src/components/editor/monaco-reveal.ts`, `use-monaco-reveal-scheduler.ts` | Type widened from `IStandaloneCodeEditor` to `ICodeEditor` so the diff editor can reuse the scheduler. |
| `src/renderer/src/components/virtualized-list.tsx` | `scrollToRowKey`, `alignRowWithinScrollPadding`, the flow-path wrapper. Heavily edited — merge with care. |
| `src/renderer/.../checks-panel/comment-row.tsx`, `comment-group.tsx`, `use-comments-list-state.tsx` | The `onOpenLocation` prop and the clickable path badge. |
| `src/renderer/.../source-control/listing/*` | `activeOpenRowKey`, the branch-row `isOpenFile` highlight, the published review order in `use-file-listing.ts`. |
| `src/renderer/.../source-control/panel/panel-ready.tsx` | `scroll-pb-9` on the file-list scroller — reserves the sticky Commits header. |
| `src/renderer/.../listing/active-open-file-keys.ts` | The `branch::<path>` key. Branch keys **must bypass** the availability filter. |

Three upstream **test** files carry our additions. Take upstream's version, then re-apply:

- `source-control-active-open-file-keys.test.ts` — the branch-key tests.
- `source-control-branch-section-heading.test.tsx`, `section-action-buttons.test.tsx` —
  `activeOpenRowKeys` / `activeOpenRowKey` props on the branch section.

## Verify

Run all of these. They are the same gates upstream's CI uses.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Then confirm the fork channel actually survived the merge — a clean test run does **not** prove
this, because the defaults are upstream's on purpose:

```bash
# Each must print a match. A miss means the update channel was lost in the merge.
grep -n "armForkUpdateChannel" src/main/index.ts
grep -n "ORCA_RELEASES_REPO_URL" src/main/updater-prerelease-feed.ts
grep -n "ORCA_UPDATE_FEED_URL" src/main/updater/updater-setup.ts src/main/updater/updater-release-feed.ts
grep -n "isManualInstallOnlyUpdate" src/main/updater/updater-download-install.ts
grep -n "frbarbre" config/electron-builder.config.cjs
```

If `pnpm test` reports failures, check whether they also fail on upstream before assuming the merge
caused them — stash the merge and re-run the failing files. Upstream has some tests that fail on a
clean checkout.

## Releasing

`gh workflow run fork-release.yml --ref main`, or push a `v*` tag. The workflow builds on a
GitHub-hosted macOS runner and publishes to this fork's releases, which is where the installed app
looks.

The app **notifies** about a new release and opens the release page; it never installs. That is
deliberate: macOS hands the swap to Squirrel.Mac, which refuses a bundle whose signature it cannot
verify, and this fork has no Developer ID. Install the DMG by hand.
