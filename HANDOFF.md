# Handoff

Working context for continuing this fork on a Linux server. For merge-conflict rules, read
[`FORK.md`](./FORK.md) — that is the durable document; this one is the state of play.

## What this fork is

`frbarbre/orca`, a fork of `stablyai/orca`. It exists to carry two editor features plus the
packaging changes needed to install and update a fork build. Everything else tracks upstream.

The owner runs the fork build as their daily Orca on macOS. The official app is replaced, not
installed alongside — same `appId`, so settings and worktrees carry over.

## Get going

```bash
git clone https://github.com/frbarbre/orca.git
cd orca
proto install pnpm 12.0.0      # package.json pins pnpm 12; node 24 is required
pnpm install
pnpm -C mobile install --frozen-lockfile   # separate pnpm project; needed by build:release
```

Then confirm the tree is healthy before changing anything:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

`pnpm test` is ~90k tests and takes a while. A handful fail on a clean upstream checkout — see
[Verifying](#verifying).

## What is different on Linux

Read this before trying to reproduce anything the earlier session did.

- **You cannot build or run the macOS artifact.** Releases are built by GitHub Actions on a hosted
  `macos-15` runner, so cutting a release still works from anywhere — you just cannot verify the
  resulting app locally.
- **`pnpm install:release` is macOS-specific.** It adds x64+arm64 native deps for the dual-arch mac
  build. On Linux a plain `pnpm install` is right; the workflow handles the release case itself.
- **The previous session verified UI behaviour by driving the running app over the Chrome DevTools
  Protocol** (`pnpm dev` exposes it on `127.0.0.1:9477`, and the renderer puts the Zustand store on
  `window.__store`). That was how the diff-navigation bugs were found and proven. On a headless
  server this needs a display — `xvfb-run pnpm dev` may work, but it is unproven here. **Assume you
  are relying on unit tests instead**, and say so plainly rather than claiming behaviour is verified
  when it was only reasoned about.

## Current state

**Landed on `main` and released.** The last release is `v1.4.197` (9 assets, published, feed
verified). A `v1.4.198` build was in flight at handoff purely to test the update notice — check
`gh run list --repo frbarbre/orca --workflow fork-release.yml` for how it ended.

Two feature groups, both working and covered by tests:

1. **Changed-file navigation.** `editor.previousFile` / `editor.nextFile` step through the Source
   Control panel's *visible* order, honouring filter, collapsed directories and tree/list mode. The
   open file's row highlights (including branch/PR rows, which had no highlight at all before) and
   scrolls into view, kept clear of the sticky Commits header.
2. **Review-comment links.** The `file.ts:L208` badge in the checks panel opens that file's diff at
   that line. This was a *gap*, not a feature: the sibling Source Control panel already did it for
   its own notes; the checks panel just never wired it up.

Plus the fork update channel — see [`FORK.md`](./FORK.md#1-fork-update-channel--keep-and-check-carefully).

## Decisions, and why

Do not undo these without reading the reasoning; several were arrived at after getting them wrong
first.

- **The updater URL defaults stay pointing at upstream.** The fork is selected at runtime by
  `armForkUpdateChannel()` setting env vars. Re-pointing the literals instead means editing nine
  upstream test files and re-resolving them on every merge. This is the single most likely thing for
  an agent to "helpfully" break.
- **The build is unsigned, so the app notifies instead of installing.** macOS hands the swap to
  Squirrel.Mac, which refuses a bundle whose signature it cannot verify; a Developer ID costs
  $99/year and the owner declined. Download and Install both open the release page.
- **The release workflow packages with `--publish never` and uploads once.** electron-builder
  publishes from each arch pass, and a draft release does not reserve its tag, so the two passes
  created two releases with the assets split across them — one without `latest-mac.yml`, which the
  updater feed needs. The workflow now refuses to publish if that file is missing.
- **Release version can be overridden** via the workflow's `version` input
  (`-c.extraMetadata.version`), because the notice only fires for a version *higher* than the
  installed build, and the fork otherwise rides upstream's version. Do not edit `package.json`.
- **Keyboard defaults are `Alt+F7` / `Alt+Shift+F7`, not Shift+Arrow.** Shift+Arrow is Monaco's
  text-selection chord. Both actions set `allowBareKeybindings` and `allowShiftOnlyKeybindings`, so
  the owner can bind Shift+Arrow in `~/.orca/keybindings.json`.
- **Review order is keyed `<area>::<path>`, never by path.** A file changed in the working tree *and*
  on the branch has a row in both sections; deduping by path made the branch row unreachable.

## Verifying

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Then the fork-channel greps in [`FORK.md`](./FORK.md#verify) — a green test run does **not** prove
the update channel survived, because the defaults are upstream's on purpose.

Targeted suites for the feature work:

```bash
pnpm vitest run --config config/vitest.config.ts \
  src/renderer/src/store/slices/editor/ \
  src/renderer/src/components/right-sidebar/ \
  src/renderer/src/components/virtualized-list.test.tsx \
  src/main/updater
```

Note the `--config config/vitest.config.ts`. Without it, path aliases do not resolve and tests fail
in a way that looks like a real break but is not.

**Before blaming a failure on your change, check it against a clean tree** (`git stash -u`, re-run,
`git stash pop`). Upstream has tests that fail on a clean checkout, and that cost real time twice.

## Releasing

```bash
gh workflow run fork-release.yml --repo frbarbre/orca --ref main
gh workflow run fork-release.yml --repo frbarbre/orca --ref main -f version=1.4.199   # to bump
```

Builds on a hosted macOS runner, publishes one release with all artifacts to this fork. The installed
app reads `https://github.com/frbarbre/orca/releases/latest/download/latest-mac.yml`; curl that URL
after a release — a 200 with the expected version is the only real proof the chain works.

## Known gaps

- **The update notice has never been observed firing.** It needs a published version higher than the
  installed build. Checks are throttled to once per 24h and triggered by window focus or wake from
  sleep, so a restart does not force one — use "Check for Updates" in the menu.
- **The daily upstream-merge agent does not exist yet.** `FORK.md` was written for it.
- **The keybindings have not been exercised by hand**, only by calling `stepToChangedFile` directly.
- **Nothing is upstreamed.** The two editor features were deliberately kept upstreamable and would
  be better as PRs to `stablyai/orca` than as a fork maintained forever; the updater changes never
  would be. Upstream requires a linked issue (`Fixes #`), before/after visuals, and an AI-disclosure
  section — see `.github/pull_request_template.md`.
