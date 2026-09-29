import React from 'react'
import { Play, X } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

function MediaLightbox({
  label,
  expandLabel,
  trigger,
  triggerClassName,
  children
}: {
  label: string
  expandLabel: string
  trigger: React.ReactNode
  triggerClassName?: string
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative my-3 block max-w-full cursor-zoom-in border-0 bg-transparent p-0 text-left',
            triggerClassName
          )}
          onClick={(event) => {
            // Why: prevent parent row/card handlers from treating the zoom click
            // as selection/navigation.
            event.stopPropagation()
          }}
          aria-label={expandLabel}
        >
          {trigger}
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[90dvh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw]"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate('auto.components.sidebar.MarkdownImageLightbox.close', 'Close')}
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-4 scrollbar-editor">
          {children}
        </div>
      </DialogContent>
    </Dialog>
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
      label={label}
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
    >
      <img src={src} alt={label} className="size-full rounded-md object-contain" />
    </MediaLightbox>
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
      label={label}
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
    >
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="size-full rounded-md bg-black object-contain"
      />
    </MediaLightbox>
  )
}
