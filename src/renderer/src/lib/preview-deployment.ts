import type { PRComment } from '../../../shared/github/comment-types'
import { formatUiRelativeTime } from '@/i18n/relative-time-format'
import { translate } from '@/i18n/i18n'

export type PreviewDeployment = { url: string; sha: string | null; createdAt: string }

const PREVIEW_HEADING = /preview deployment/i
const PREVIEW_URL = /https?:\/\/[^\s)>\]]+/
const PREVIEW_SHA = /`([0-9a-f]{7,40})`/i

function parsePreviewComment(comment: PRComment): PreviewDeployment | null {
  if (!comment.isBot || comment.path || comment.threadId || !PREVIEW_HEADING.test(comment.body)) {
    return null
  }
  const url = comment.body.match(PREVIEW_URL)?.[0]
  if (!url) {
    return null
  }
  return { url, sha: comment.body.match(PREVIEW_SHA)?.[1] ?? null, createdAt: comment.createdAt }
}

export function findLatestPreviewDeployment(
  comments: readonly PRComment[]
): PreviewDeployment | null {
  let latest: PreviewDeployment | null = null
  for (const comment of comments) {
    const deployment = parsePreviewComment(comment)
    if (
      deployment &&
      (!latest || Date.parse(deployment.createdAt) > Date.parse(latest.createdAt))
    ) {
      latest = deployment
    }
  }
  return latest
}

export function previewDeploymentTooltip(
  deployment: PreviewDeployment,
  headSha: string | undefined,
  now: number
): string {
  const parts = [
    deployment.sha
      ? translate('auto.lib.previewDeployment.openOf', 'Open preview of {{sha}}', {
          sha: deployment.sha
        })
      : translate('auto.lib.previewDeployment.open', 'Open preview'),
    formatUiRelativeTime(Date.parse(deployment.createdAt) - now)
  ]
  if (deployment.sha && headSha && !headSha.startsWith(deployment.sha)) {
    parts.push(translate('auto.lib.previewDeployment.behind', 'not the latest commit'))
  }
  return parts.join(' · ')
}
