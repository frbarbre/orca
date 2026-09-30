import React, { createContext, useContext, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

export type LightboxItem = { kind: 'image' | 'video'; src: string; label: string }

type GalleryEntry = LightboxItem & { element: HTMLElement | null }

type Gallery = {
  register: (id: string, entry: GalleryEntry) => () => void
  open: (id: string) => void
}

const GalleryContext = createContext<Gallery | null>(null)

export function useMediaGallery(): Gallery | null {
  return useContext(GalleryContext)
}

function documentOrder(a: GalleryEntry, b: GalleryEntry): number {
  if (!a.element || !b.element) {
    return 0
  }
  return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}

function LightboxMedia({ item }: { item: LightboxItem }): React.JSX.Element {
  return item.kind === 'image' ? (
    <img src={item.src} alt={item.label} className="size-full rounded-md object-contain" />
  ) : (
    <video
      key={item.src}
      src={item.src}
      controls
      autoPlay
      playsInline
      className="size-full rounded-md bg-black object-contain"
    />
  )
}

export function LightboxDialog({
  items,
  index,
  onIndexChange,
  onClose,
  returnFocusTo
}: {
  items: readonly LightboxItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  returnFocusTo: HTMLElement | null
}): React.JSX.Element | null {
  const item = items[index]
  if (!item) {
    return null
  }
  const many = items.length > 1
  const step = (delta: number): void => onIndexChange((index + delta + items.length) % items.length)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[90dvh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw]"
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          // Why: there is no DialogTrigger to return to, so focus goes back to what opened it.
          if (returnFocusTo?.isConnected) {
            event.preventDefault()
            returnFocusTo.focus()
          }
        }}
        onKeyDown={(event) => {
          // Why not on a focused video: its own arrow keys seek, and a seek must not change the item.
          if (!many || event.target instanceof HTMLVideoElement) {
            return
          }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            step(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
      >
        <DialogTitle className="sr-only">{item.label}</DialogTitle>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{item.label}</span>
          <div className="flex shrink-0 items-center gap-2">
            {many ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {index + 1} / {items.length}
              </span>
            ) : null}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={translate(
                  'auto.components.sidebar.MarkdownImageLightbox.close',
                  'Close'
                )}
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-4 scrollbar-editor">
          <LightboxMedia item={item} />
          {many ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 left-3 -translate-y-1/2"
                aria-label={translate(
                  'auto.components.sidebar.MarkdownImageLightbox.previous',
                  'Previous'
                )}
                onClick={() => step(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute top-1/2 right-3 -translate-y-1/2"
                aria-label={translate('auto.components.sidebar.MarkdownImageLightbox.next', 'Next')}
                onClick={() => step(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Why one per comment: arrow keys should walk the images and videos of the comment you opened, in
// the order they appear, not every image on the page.
export function MediaGalleryProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const entries = useRef(new Map<string, GalleryEntry>())
  const [view, setView] = useState<{
    items: LightboxItem[]
    index: number
    opener: HTMLElement | null
  } | null>(null)
  const gallery = useMemo<Gallery>(
    () => ({
      register: (id, entry) => {
        entries.current.set(id, entry)
        return () => {
          entries.current.delete(id)
        }
      },
      open: (id) => {
        const ordered = [...entries.current.entries()]
          .filter(([key, entry]) => key === id || entry.element?.isConnected)
          .sort(([, a], [, b]) => documentOrder(a, b))
        const items = ordered.map(([, { kind, src, label }]) => ({ kind, src, label }))
        setView({
          items,
          index: Math.max(
            0,
            ordered.findIndex(([key]) => key === id)
          ),
          opener: entries.current.get(id)?.element ?? null
        })
      }
    }),
    []
  )

  return (
    <GalleryContext.Provider value={gallery}>
      {children}
      {view ? (
        <LightboxDialog
          items={view.items}
          index={view.index}
          onIndexChange={(index) => setView({ ...view, index })}
          onClose={() => setView(null)}
          returnFocusTo={view.opener}
        />
      ) : null}
    </GalleryContext.Provider>
  )
}
