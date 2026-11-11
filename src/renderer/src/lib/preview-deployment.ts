import type { PRComment } from '../../../shared/github/comment-types'
import { formatUiRelativeTime } from '@/i18n/relative-time-format'
import { translate } from '@/i18n/i18n'

export type PreviewDeployment = { url: string; sha: string | null; createdAt: string }

const PREVIEW_HEADING = /(\w*)\s*preview deployment/i
const PREVIEW_URL = /https?:\/\/[^\s)>\]]+/
const PREVIEW_SHA = /`([0-9a-f]{7,40})`/i

type ParsedPreview = { deployment: PreviewDeployment; isFrontend: boolean }

function parsePreviewComment(comment: PRComment): ParsedPreview | null {
  const heading = comment.body.match(PREVIEW_HEADING)
  if (!comment.isBot || comment.path || comment.threadId || !heading) {
    return null
  }
  const url = comment.body.match(PREVIEW_URL)?.[0]
  if (!url) {
    return null
  }
  const app = heading[1].toLowerCase()
  return {
    deployment: {
      url,
      sha: comment.body.match(PREVIEW_SHA)?.[1] ?? null,
      createdAt: comment.createdAt
    },
    isFrontend: app === '' || app === 'frontend'
  }
}

function newest(previews: readonly PreviewDeployment[]): PreviewDeployment | null {
  let latest: PreviewDeployment | null = null
  for (const deployment of previews) {
    if (!latest || Date.parse(deployment.createdAt) > Date.parse(latest.createdAt)) {
      latest = deployment
    }
  }
  return latest
}

export function findLatestPreviewDeployment(
  comments: readonly PRComment[]
): PreviewDeployment | null {
  const previews = comments.flatMap((comment) => parsePreviewComment(comment) ?? [])
  // Why: each app (Frontend, Insights, ...) posts its own preview per push; the frontend is the one to open.
  const frontend = previews.filter((p) => p.isFrontend).map((p) => p.deployment)
  return newest(frontend) ?? newest(previews.map((p) => p.deployment))
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
