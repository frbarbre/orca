import React, { useEffect, useId, useRef, useState } from 'react'
import { Play } from 'lucide-react'
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
  src: string
  alt?: string
  className?: string
  triggerClassName?: string
  onError?: () => void
}

export function ExpandableMarkdownImage({
  src,
  alt,
  className,
  triggerClassName,
  onError
}: ExpandableMarkdownImageProps): React.JSX.Element {
  const label =
    alt?.trim() || translate('auto.components.sidebar.MarkdownImageLightbox.image', 'Image')
  return (
    <MediaLightbox
      item={{ kind: 'image', src, label }}
      expandLabel={translate(
        'auto.components.sidebar.MarkdownImageLightbox.expand',
        'Expand image'
      )}
      triggerClassName={triggerClassName}
      trigger={
        <img
          src={src}
          alt={alt ?? ''}
          className={cn(className, 'pointer-events-none')}
          onError={onError}
        />
      }
    />
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
