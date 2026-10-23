import { describe, expect, it } from 'vitest'
import { parsePortLabels, pickFrontendPortLabel } from './workspace-port-labels'

const OUTPUT = `[print-urls] $ moon run root:print-urls
▮▮▮▮ root:print-urls (c8cc1dd6)
Frontend      http://e-4871.localhost:21486
Backend docs  http://e-4871.localhost:22844/v1/docs
Restate UI    http://e-4871.localhost:21492
Spotlight     http://e-4871.localhost:21495
▮▮▮▮ root:print-urls (477ms, c8cc1dd6)

Tasks: 1 completed`

describe('parsePortLabels', () => {
  it('reads each label and URL the command prints, keyed by port', () => {
    expect(parsePortLabels(OUTPUT)).toEqual([
      { label: 'Frontend', url: 'http://e-4871.localhost:21486', port: 21486 },
      { label: 'Backend docs', url: 'http://e-4871.localhost:22844/v1/docs', port: 22844 },
      { label: 'Restate UI', url: 'http://e-4871.localhost:21492', port: 21492 },
      { label: 'Spotlight', url: 'http://e-4871.localhost:21495', port: 21495 }
    ])
  })

  it("takes a URL's default port and keeps the first label for a port", () => {
    expect(
      parsePortLabels('App  https://app.localhost\nAlso app  https://app.localhost/admin')
    ).toEqual([{ label: 'App', url: 'https://app.localhost', port: 443 }])
  })

  it('reads nothing from output without labelled URLs', () => {
    expect(parsePortLabels('error: task not found\nhttp://bare.localhost:1')).toEqual([])
  })
})

describe('pickFrontendPortLabel', () => {
  const labels = parsePortLabels(OUTPUT)

  it('picks the frontend while something listens on its port', () => {
    expect(pickFrontendPortLabel(labels, [21486, 21495])?.label).toBe('Frontend')
  })

  it('picks nothing while the frontend is not running', () => {
    expect(pickFrontendPortLabel(labels, [21495])).toBeNull()
  })

  it('picks whichever frontend is running, the first listed when several are', () => {
    const frontends = [
      { label: 'Frontend dev server', port: 21486, url: 'http://e-4871.localhost:21486' },
      { label: 'Frontend prebuild', port: 21499, url: 'http://e-4871.localhost:21499' }
    ]
    expect(pickFrontendPortLabel(frontends, [21499])?.label).toBe('Frontend prebuild')
    expect(pickFrontendPortLabel(frontends, [21486, 21499])?.label).toBe('Frontend dev server')
    expect(pickFrontendPortLabel(frontends, [])).toBeNull()
  })

  it('falls back to the first entry when none is called frontend', () => {
    const [, ...rest] = labels
    expect(pickFrontendPortLabel(rest, [22844])?.label).toBe('Backend docs')
  })
})
