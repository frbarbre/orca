import type { PreloadApi } from '../../../../preload/api-types'

// Why refused rather than routed: submitting a review acts on the desktop app's own
// queued comments, which the web client does not hold.
export function createWebPendingReviewApi(): Pick<PreloadApi, 'pendingReview'> {
  return {
    pendingReview: {
      submit: () =>
        Promise.resolve({
          ok: false as const,
          error: 'Reviews are submitted from the desktop app.'
        })
    }
  }
}
