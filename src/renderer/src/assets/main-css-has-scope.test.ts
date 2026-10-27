import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.resolve('@tailwindcss/vite'))
const { compile } = require('@tailwindcss/node')
const { Scanner } = require('@tailwindcss/oxide')

// Why: Chromium cannot scope a :has() nested in `:is(… *)`, so any DOM write restyles the whole page;
// Tailwind's group-has-*/peer-has-* variants compile to exactly that and made editor scrolling crawl.
it('generates no :has() selector that any element on the page could depend on', async () => {
  const assets = resolve('src/renderer/src/assets')
  const compiler = await compile(readFileSync(resolve(assets, 'main.css'), 'utf8'), {
    base: assets,
    onDependency() {}
  })
  const automaticSources =
    compiler.root === 'none'
      ? []
      : [compiler.root ?? { base: resolve('src/renderer/src'), pattern: '**/*' }]
  const scanner = new Scanner({
    sources: [
      ...automaticSources.map((source: object) => ({ ...source, negated: false })),
      ...compiler.sources
    ]
  })
  const css: string = compiler.build(scanner.scan())

  const unscoped = css.match(/[^{}]*:has\([^{}]*\) \*\)[^{}]*\{/g) ?? []
  expect(unscoped.map((selector) => selector.trim())).toEqual([])
}, 60_000)
