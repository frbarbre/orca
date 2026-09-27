import type { PreloadApi } from '../../../../preload/api-types'
import { translate } from '@/i18n/i18n'

// Why refused rather than routed: submitting a review acts on the desktop app's own
// queued comments, which the web client does not hold.
export function createWebPendingReviewApi(): Pick<PreloadApi, 'pendingReview'> {
  return {
    pendingReview: {
      submit: () =>
        Promise.resolve({
          ok: false as const,
          error: translate(
            'auto.web.pendingReview.submitDesktopOnly',
            'Reviews are submitted from the desktop app.'
          )
        }),
      // Why empty: a web client cannot submit a review, so it has no queue of its own to keep.
      readDrafts: () => Promise.resolve({}),
      writeDrafts: () => Promise.resolve(),
      updateComment: () =>
        Promise.resolve({
          ok: false as const,
          error: translate(
            'auto.web.pendingReview.editDesktopOnly',
            'Comments are edited from the desktop app.'
          )
        }),
      context: () =>
        Promise.resolve({
          viewerDidAuthor: false,
          viewerLatestReviewState: null,
          viewerHasReviewRequest: false,
          viewerLatestReviewCommit: null
        })
    }
  }
}
