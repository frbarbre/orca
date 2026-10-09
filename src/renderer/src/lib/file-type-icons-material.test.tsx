// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Smartphone } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { getFileTypeIcon } from './file-type-icons'

function renderedIcon(path: string): string | null {
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => root.render(createElement(getFileTypeIcon(path), { className: 'size-4' })))
  const src = container.querySelector('img')?.getAttribute('src') ?? null
  act(() => root.unmount())
  return src
}

describe('getFileTypeIcon (Material icons)', () => {
  it("shows the Material icon for the file's name or extension", () => {
    expect(renderedIcon('apps/frontend/package.json')).toMatch(/\/nodejs\.svg/)
    expect(renderedIcon('apps/backend/interpreter/scope.py')).toMatch(/\/python\.svg/)
    expect(renderedIcon('src/App.tsx')).toMatch(/\/react_ts\.svg/)
  })

  it('gives one component per path, so a re-render keeps the same icon element', () => {
    expect(getFileTypeIcon('src/a.ts')).toBe(getFileTypeIcon('src/a.ts'))
  })

  it("keeps the simulator tab's own icon", () => {
    expect(getFileTypeIcon('Simulator')).toBe(Smartphone)
  })
})
