import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { shelfResizeTarget } from './shelf-sizing'

const DEFAULT_SHELF_HEIGHT_PX = 240
// Why 28: a SectionHeader's height, so dragging can shrink a section to its header but never cut it.
const SHELF_MIN_HEIGHT_PX = 28
const FILES_MIN_HEIGHT_PX = 120
const STORAGE_PREFIX = 'orca.sourceControl.sectionHeight.'

export type ResizableShelf = { id: string; node: React.ReactNode }

function readPreferredHeight(id: string): number | null {
  try {
    const stored = Number(localStorage.getItem(`${STORAGE_PREFIX}${id}`))
    return stored > SHELF_MIN_HEIGHT_PX ? stored : null
  } catch {
    return null
  }
}

// Why half the panel: until the user drags a section, it shows all of itself unless that would
// crowd out the changed files.
function preferredHeight(id: string, panel: PanelImperativeHandle): number {
  const stored = readPreferredHeight(id)
  if (stored !== null) {
    return stored
  }
  const { inPixels, asPercentage } = panel.getSize()
  const groupHeight = asPercentage > 0 ? (inPixels * 100) / asPercentage : 0
  return Math.max(DEFAULT_SHELF_HEIGHT_PX, groupHeight / 2)
}

function writePreferredHeight(id: string, height: number): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, String(Math.round(height)))
  } catch {
    // A remembered height is a convenience; the default still applies.
  }
}

function ShelfPanel({
  id,
  register,
  children
}: {
  id: string
  register: (id: string, panel: React.RefObject<PanelImperativeHandle | null> | null) => void
  children: React.ReactNode
}): React.JSX.Element {
  const panelRef = usePanelRef()
  const contentRef = useRef<HTMLDivElement>(null)
  const previousNatural = useRef(0)
  const [natural, setNatural] = useState(0)

  useLayoutEffect(() => {
    register(id, panelRef)
    return () => register(id, null)
  }, [id, panelRef, register])

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) {
      return
    }
    const observer = new ResizeObserver(() => setNatural(content.offsetHeight))
    observer.observe(content)
    setNatural(content.offsetHeight)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (natural === 0) {
      return
    }
    // Why a frame later: the group applies the new maxSize after this render commits, and a
    // resize before that is clamped to the old content height.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) {
        return
      }
      try {
        const target = shelfResizeTarget({
          size: panel.getSize().inPixels,
          natural,
          previousNatural: previousNatural.current,
          preferred: preferredHeight(id, panel)
        })
        previousNatural.current = natural
        if (target !== null) {
          panel.resize(target)
        }
      } catch {
        // The group registers panels after layout; the next measurement sizes it.
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [id, natural, panelRef])

  return (
    <>
      <ResizablePanel
        id={id}
        panelRef={panelRef}
        defaultSize={`${readPreferredHeight(id) ?? DEFAULT_SHELF_HEIGHT_PX}px`}
        minSize={`${Math.min(natural || SHELF_MIN_HEIGHT_PX, SHELF_MIN_HEIGHT_PX)}px`}
        {...(natural > 0 ? { maxSize: `${natural}px` } : {})}
        groupResizeBehavior="preserve-pixel-size"
      >
        <div className="h-full overflow-y-auto scrollbar-sleek">
          <div ref={contentRef}>{children}</div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
    </>
  )
}

// Fork: every source-control section sits in a vertical resizable group, so a long notes list can
// be dragged short and the changed files keep their room.
export function SourceControlResizableSections({
  shelves,
  children
}: {
  shelves: readonly ResizableShelf[]
  children: React.ReactNode
}): React.JSX.Element {
  const panels = useRef(new Map<string, React.RefObject<PanelImperativeHandle | null>>())
  const register = useCallback(
    (id: string, panel: React.RefObject<PanelImperativeHandle | null> | null) => {
      if (panel) {
        panels.current.set(id, panel)
      } else {
        panels.current.delete(id)
      }
    },
    []
  )
  const lastHeights = useRef(new Map<string, number>())
  // Why only the panels the drag changed: a collapsed neighbour's header height is not a height
  // the user chose, and saving it would reopen that section header-only.
  const rememberDraggedHeights = useCallback(
    (_layout: unknown, meta: { isUserInteraction: boolean }) => {
      for (const [id, panel] of panels.current) {
        const height = panel.current?.getSize().inPixels ?? 0
        const previous = lastHeights.current.get(id)
        lastHeights.current.set(id, height)
        if (
          meta.isUserInteraction &&
          previous !== undefined &&
          Math.abs(height - previous) > 1 &&
          height > SHELF_MIN_HEIGHT_PX
        ) {
          writePreferredHeight(id, height)
        }
      }
    },
    []
  )

  return (
    <ResizablePanelGroup
      key={shelves.map((shelf) => shelf.id).join(',')}
      orientation="vertical"
      className="min-h-0 flex-1"
      onLayoutChanged={rememberDraggedHeights}
    >
      {shelves.map((shelf) => (
        <ShelfPanel key={shelf.id} id={shelf.id} register={register}>
          {shelf.node}
        </ShelfPanel>
      ))}
      <ResizablePanel
        id="files"
        minSize={`${FILES_MIN_HEIGHT_PX}px`}
        className="flex h-full flex-col"
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
