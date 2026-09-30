import React from 'react'
import { useGitHubAttachmentSrc } from '@/lib/github-attachment-src'
import { ExpandableMarkdownImage, ExpandableMarkdownVideo } from './MarkdownImageLightbox'

export function isGitHubUserAttachmentUrl(href: string | undefined): href is string {
  if (!href) {
    return false
  }
  try {
    const url = new URL(href)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith('/user-attachments/assets/')
    )
  } catch {
    return false
  }
}

function isBareAutolink(children: React.ReactNode, href: string): boolean {
  const text = React.Children.toArray(children).join('').trim()
  return text === href
}

export function isGitHubUserAttachmentVideoLink(
  href: string | undefined,
  children: React.ReactNode
): href is string {
  return isGitHubUserAttachmentUrl(href) && isBareAutolink(children, href)
}

// Shared fallback link for attachments that can't render inline (see the image
// note below on why load failures drop to a session-scoped link).
function AttachmentFallbackLink({
  href,
  children
}: {
  href: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}

function AttachmentPending({ className }: { className: string }): React.ReactElement {
  return <span className={`my-3 block h-24 w-40 animate-pulse bg-muted ${className}`} />
}

export function GitHubUserAttachmentVideo({
  href,
  children,
  className = 'max-h-[28rem] max-w-full rounded-md bg-black/80 outline outline-1 outline-black/10 dark:outline-white/10'
}: {
  href: string
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  const [failed, setFailed] = React.useState(false)
  const resolved = useGitHubAttachmentSrc(href)

  if (failed || resolved.status === 'failed') {
    return <AttachmentFallbackLink href={href}>{children}</AttachmentFallbackLink>
  }
  if (resolved.status === 'pending') {
    return <AttachmentPending className="rounded-md" />
  }

  return (
    <ExpandableMarkdownVideo
      src={resolved.src}
      label={React.Children.toArray(children).join('').trim() || href}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}

export function GitHubUserAttachmentImage({
  src,
  alt,
  className = 'max-h-96 max-w-full rounded-md object-contain outline outline-1 outline-black/10 dark:outline-white/10'
}: {
  src: string
  alt: string | undefined
  className?: string
}): React.ReactElement {
  const [failed, setFailed] = React.useState(false)
  const resolved = useGitHubAttachmentSrc(src)

  // Why a link on failure: one that main cannot resolve (no gh login, no access) still opens in a
  // browser where a github.com session may exist.
  if (failed || resolved.status === 'failed') {
    return <AttachmentFallbackLink href={src}>{alt?.trim() || src}</AttachmentFallbackLink>
  }
  if (resolved.status === 'pending') {
    return <AttachmentPending className="rounded-md" />
  }

  return (
    <ExpandableMarkdownImage
      src={resolved.src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
