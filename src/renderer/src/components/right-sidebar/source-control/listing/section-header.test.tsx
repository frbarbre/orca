// @vitest-environment happy-dom
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionHeader } from './section-header'

describe('SectionHeader', () => {
  it('renders section label and file count without wrapping classes', () => {
    const { container } = render(
      <SectionHeader
        label="Changes"
        count={13}
        isCollapsed={false}
        onToggle={vi.fn()}
        actions={<button type="button">Action</button>}
      />
    )

    expect(screen.getByText('Changes')).toBeDefined()
    expect(screen.getByText('13')).toBeDefined()
    expect(screen.getByRole('button', { name: /Changes/i })).toBeDefined()

    // Ensure flex-wrap is not used on container or action clusters
    const sectionRow = container.querySelector('.group\\/section')
    expect(sectionRow).not.toBeNull()
    expect(sectionRow?.className).not.toContain('flex-wrap')
    expect(sectionRow?.className).toContain('flex')

    // Ensure actions container does not wrap and has shrink-0
    const actionsContainer = sectionRow?.lastElementChild
    expect(actionsContainer?.className).toContain('shrink-0')
    expect(actionsContainer?.className).not.toContain('flex-wrap')

    // Ensure label has truncate to prevent overflowing row on narrow widths
    const labelSpan = screen.getByText('Changes')
    expect(labelSpan.className).toContain('truncate')
  })

  it('is a sticky 28px row styled like the Commits header', () => {
    const { container } = render(
      <SectionHeader
        label="Changes"
        count={2}
        conflictCount={1}
        isCollapsed={false}
        onToggle={vi.fn()}
      />
    )
    const root = container.firstElementChild
    expect(root?.className).toContain('sticky')
    expect(root?.className).toContain('top-0')
    expect(root?.className).toContain('h-7')
    expect(root?.className).toContain('bg-sidebar')
    const toggle = within(container as HTMLElement).getByRole('button', { name: /Changes/i })
    expect(toggle.className).toContain('text-[11px]')
    expect(toggle.textContent).toContain('1 conflict')
  })

  it('calls onToggle when header button is clicked', () => {
    const onToggle = vi.fn()
    render(
      <SectionHeader label="Staged Changes" count={5} isCollapsed={true} onToggle={onToggle} />
    )

    fireEvent.click(screen.getByRole('button', { name: /Staged Changes/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
