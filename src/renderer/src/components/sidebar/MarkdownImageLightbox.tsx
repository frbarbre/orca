import React, { useEffect, useId, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { PanZoomImageDialog } from '@/components/editor/PanZoomImageDialog'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { LightboxDialog, useMediaGallery, type LightboxItem } from './media-lightbox-gallery'

function MediaLightbox({
  item,
  expandLabel,
  trigger,
  triggerClassName
}: {
  item: LightboxItem
  expandLabel: string
  trigger: React.ReactNode
  triggerClassName?: string
}): React.JSX.Element {
  const id = useId()
  const gallery = useMediaGallery()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const { kind, src, label } = item

  useEffect(
    () => gallery?.register(id, { kind, src, label, element: buttonRef.current }),
    [gallery, id, kind, src, label]
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'relative my-3 block max-w-full cursor-zoom-in border-0 bg-transparent p-0 text-left',
          triggerClassName
        )}
        onClick={(event) => {
          // Why: prevent parent row/card handlers from treating the zoom click
          // as selection/navigation.
          event.stopPropagation()
          if (gallery) {
            gallery.open(id)
          } else {
            setOpen(true)
          }
        }}
        aria-label={expandLabel}
      >
        {trigger}
      </button>
      {open ? (
        <LightboxDialog
          items={[item]}
          index={0}
          onIndexChange={() => undefined}
          onClose={() => setOpen(false)}
          returnFocusTo={buttonRef.current}
        />
      ) : null}
    </>
  )
}

type ExpandableMarkdownImageProps = {
  src: string | undefined
  alt?: string
  className?: string
  triggerClassName?: string
  onError?: () => void
  onLoad?: React.ReactEventHandler<HTMLImageElement>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerLabel?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onAuxClick?: React.MouseEventHandler<HTMLButtonElement>
  triggerAttributes?: Record<`data-${string}`, string | undefined>
  triggerRef?: React.Ref<HTMLButtonElement>
  triggerStyle?: React.CSSProperties
  dialogProps?: Omit<
    React.ComponentProps<typeof PanZoomImageDialog>,
    'open' | 'onOpenChange' | 'src' | 'title' | 'showTitle'
  >
}

export function ExpandableMarkdownImage({
  src,
  alt,
  className,
  triggerClassName,
  onError,
  onLoad,
  open: controlledOpen,
  onOpenChange,
  triggerLabel,
  onClick,
  onAuxClick,
  triggerAttributes,
  triggerRef,
  triggerStyle,
  dialogProps
}: ExpandableMarkdownImageProps): React.JSX.Element {
  const id = useId()
  const gallery = useMediaGallery()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (nextOpen: boolean): void => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }
  const label =
    alt?.trim() || translate('auto.components.sidebar.MarkdownImageLightbox.image', 'Image')
  // Fork: inside a comment's media gallery an uncontrolled image opens there, so arrows step through its siblings.
  const galleryOwned = Boolean(gallery && src && controlledOpen === undefined)

  useEffect(
    () =>
      gallery && src && controlledOpen === undefined
        ? gallery.register(id, { kind: 'image', src, label, element: buttonRef.current })
        : undefined,
    [gallery, id, src, label, controlledOpen]
  )

  const setTriggerRef = (element: HTMLButtonElement | null): void => {
    buttonRef.current = element
    if (typeof triggerRef === 'function') {
      triggerRef(element)
    } else if (triggerRef) {
      triggerRef.current = element
    }
  }

  return (
    <>
      <button
        ref={setTriggerRef}
        style={triggerStyle}
        type="button"
        {...triggerAttributes}
        className={cn(
          'my-3 block max-w-full cursor-zoom-in border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          triggerClassName
        )}
        onClick={(event) => {
          event.stopPropagation()
          onClick?.(event)
          if (!event.defaultPrevented) {
            event.preventDefault()
            if (galleryOwned) {
              gallery?.open(id)
            } else {
              setOpen(true)
            }
          }
        }}
        onAuxClick={onAuxClick}
        aria-label={
          triggerLabel ??
          translate('auto.components.sidebar.MarkdownImageLightbox.expand', 'Expand image')
        }
      >
        {src ? (
          <img
            src={src}
            alt={alt ?? ''}
            className={cn(className, 'pointer-events-none')}
            onError={onError}
            onLoad={onLoad}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{label}</span>
        )}
      </button>
      <PanZoomImageDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
        src={src}
        title={label}
        showTitle
      />
    </>
  )
}

export function ExpandableMarkdownVideo({
  src,
  label,
  className,
  triggerClassName,
  onError
}: {
  src: string
  label: string
  className?: string
  triggerClassName?: string
  onError?: () => void
}): React.JSX.Element {
  return (
    <MediaLightbox
      item={{ kind: 'video', src, label }}
      expandLabel={translate(
        'auto.components.sidebar.MarkdownImageLightbox.expandVideo',
        'Play video'
      )}
      triggerClassName={triggerClassName}
      trigger={
        <>
          <video
            src={src}
            preload="metadata"
            muted
            playsInline
            className={cn(className, 'pointer-events-none')}
            onError={onError}
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-black/60 text-white">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
          </span>
        </>
      }
    />
  )
}
