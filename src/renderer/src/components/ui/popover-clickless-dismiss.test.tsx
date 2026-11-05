// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

afterEach(cleanup)

const nextTask = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

async function renderOpen(contentProps: Parameters<typeof PopoverContent>[0] = {}) {
  render(
    <>
      <div data-testid="outside" />
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent {...contentProps}>
          <span>Inside</span>
        </PopoverContent>
      </Popover>
    </>
  )
  // Radix arms its outside-press listener on the next task.
  await nextTask()
}

// Why: a press on a scrollbar, or one a drag overlay ends, fires no click, and Radix only
// closes a popover on the click that follows an outside press.
function pressWithoutClick(element: Element): void {
  fireEvent.pointerDown(element, { button: 0, pointerType: 'mouse' })
  fireEvent.mouseDown(element, { button: 0 })
  fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' })
  fireEvent.mouseUp(element, { button: 0 })
}

describe('PopoverContent outside press without a click', () => {
  it('closes the popover', async () => {
    await renderOpen()
    pressWithoutClick(screen.getByTestId('outside'))
    await nextTask()

    expect(screen.queryByText('Inside')).toBeNull()
  })

  it('stays open for a press inside it', async () => {
    await renderOpen()
    pressWithoutClick(screen.getByText('Inside'))
    await nextTask()

    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('leaves the call to a popover that decides its own outside presses', async () => {
    await renderOpen({ onInteractOutside: vi.fn((event: Event) => event.preventDefault()) })
    pressWithoutClick(screen.getByTestId('outside'))
    await nextTask()

    expect(screen.getByText('Inside')).toBeInTheDocument()
  })
})
