// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestPRCommentReveal, usePRCommentReveal } from './pr-comment-reveal'

const URL_A = 'https://github.com/acme/app/pull/12#discussion_r1'
const URL_B = 'https://github.com/acme/app/pull/12#discussion_r2'

function Row({ url }: { url: string }): React.JSX.Element {
  const { ref, highlighted } = usePRCommentReveal(url)
  return (
    <div ref={ref} data-url={url} data-highlighted={highlighted ? 'true' : 'false'}>
      {url}
    </div>
  )
}

describe('PR comment reveal', () => {
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    scrollIntoView.mockReset()
    Element.prototype.scrollIntoView = scrollIntoView
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('scrolls to and briefly highlights only the comment the request names', () => {
    const { container } = render(
      <>
        <Row url={URL_A} />
        <Row url={URL_B} />
      </>
    )

    act(() => requestPRCommentReveal(URL_B))
    act(() => vi.advanceTimersByTime(10))

    const rows = container.querySelectorAll('[data-url]')
    expect(rows[0]?.getAttribute('data-highlighted')).toBe('false')
    expect(rows[1]?.getAttribute('data-highlighted')).toBe('true')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(3_000))
    expect(rows[1]?.getAttribute('data-highlighted')).toBe('false')
  })

  it('reveals a comment whose row mounts after the request, once', () => {
    act(() => requestPRCommentReveal(URL_A))
    const { container, rerender } = render(<Row url={URL_A} />)
    act(() => vi.advanceTimersByTime(10))
    expect(container.querySelector('[data-url]')?.getAttribute('data-highlighted')).toBe('true')

    rerender(<Row url={URL_A} />)
    act(() => vi.advanceTimersByTime(3_000))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
