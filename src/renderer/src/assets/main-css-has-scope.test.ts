import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.resolve('@tailwindcss/vite'))
const { compile } = require('@tailwindcss/node')
const { Scanner } = require('@tailwindcss/oxide')

async function buildMainCss(): Promise<string> {
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
      ...automaticSources.map((source: { base: string; pattern: string }) => ({
        ...source,
        negated: false
      })),
      ...compiler.sources
    ]
  })
  return compiler.build(scanner.scan())
}

function afterBodyHas(selector: string): string {
  const start = selector.indexOf('body:has(') + 'body:has('.length
  let depth = 1
  let end = start
  while (depth > 0 && end < selector.length) {
    if (selector[end] === '(') {
      depth++
    }
    if (selector[end] === ')') {
      depth--
    }
    end++
  }
  return selector.slice(end).replace(/\s+/g, ' ').trim()
}

// Why: Chromium cannot scope a :has() nested in `:is(… *)`, so any DOM write restyles the whole page;
// Tailwind's group-has-*/peer-has-* variants compile to exactly that and made editor scrolling crawl.
it('generates no :has() selector that any element on the page could depend on', async () => {
  const css = await buildMainCss()
  const unscoped = css.match(/[^{}]*:has\([^{}]*\) \*\)[^{}]*\{/g) ?? []
  expect(unscoped.map((selector) => selector.trim())).toEqual([])
}, 60_000)

// Why: every node Monaco inserts re-checks body:has(), and a match restyles everything the rule reaches.
it('styles nothing but body and the toaster from a body:has() selector', async () => {
  const css = await buildMainCss()
  const reaching = (css.match(/[^{}]*body:has\([^{}]*\{/g) ?? [])
    .map((selector) => afterBodyHas(selector.slice(0, -1)))
    .filter((rest) => rest !== '' && !rest.startsWith('[data-sonner-toaster]'))
  expect(reaching).toEqual([])
}, 60_000)
