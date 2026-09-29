import React from 'react'
import { isReviewAssetVideoUrl } from '../../../../shared/github/review-asset'
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
  return (
    (isGitHubUserAttachmentUrl(href) || isReviewAssetVideoUrl(href)) &&
    isBareAutolink(children, href)
  )
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

  if (failed) {
    return <AttachmentFallbackLink href={href}>{children}</AttachmentFallbackLink>
  }

  return (
    <ExpandableMarkdownVideo
      src={href}
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

  // Why: private-repo attachment images can't load cross-origin without the
  // user's GitHub session cookies, so drop to a link that opens where that session exists.
  if (failed) {
    return <AttachmentFallbackLink href={src}>{alt?.trim() || src}</AttachmentFallbackLink>
  }

  return (
    <ExpandableMarkdownImage
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
