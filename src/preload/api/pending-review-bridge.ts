import { ipcRenderer } from 'electron'
import type { PendingReviewApi } from './pending-review-api'

export const pendingReviewApi: PendingReviewApi = {
  submit: (request) => ipcRenderer.invoke('pending-review:submit', request),
  updateComment: (request) => ipcRenderer.invoke('pending-review:update-comment', request),
  context: (request) => ipcRenderer.invoke('pending-review:context', request)
}
