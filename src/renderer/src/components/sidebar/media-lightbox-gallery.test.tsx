// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import CommentMarkdown from './CommentMarkdown'

afterEach(() => {
  cleanup()
})

const png = (name: string): string => `![${name}](data:image/png;base64,${name})`

function openImageLabel(): string | null | undefined {
  return within(screen.getByRole('dialog')).queryAllByRole('img')[0]?.getAttribute('alt')
}

describe('comment image gallery', () => {
  it('walks the images of one comment with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup()
    render(
      <>
        <CommentMarkdown content={`${png('one')} ${png('two')} ${png('three')}`} />
        <CommentMarkdown content={png('elsewhere')} />
      </>
    )

    await user.click(screen.getAllByRole('button', { name: 'Expand image' })[1])
    expect(openImageLabel()).toBe('two')
    expect(within(screen.getByRole('dialog')).getByText('2 / 3')).toBeTruthy()

    await user.keyboard('{ArrowRight}')
    expect(openImageLabel()).toBe('three')
    await user.keyboard('{ArrowRight}')
    expect(openImageLabel()).toBe('one')
    await user.keyboard('{ArrowLeft}')
    expect(openImageLabel()).toBe('three')

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Previous' }))
    expect(openImageLabel()).toBe('two')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('shows no arrows or counter for a comment with a single image', async () => {
    const user = userEvent.setup()
    render(<CommentMarkdown content={png('alone')} />)

    await user.click(screen.getByRole('button', { name: 'Expand image' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Next' })).toBeNull()
    expect(within(dialog).queryByText('1 / 1')).toBeNull()
  })
})
