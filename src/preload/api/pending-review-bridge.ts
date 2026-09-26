import { ipcRenderer } from 'electron'
import type { PendingReviewApi } from './pending-review-api'

export const pendingReviewApi: PendingReviewApi = {
  submit: (request) => ipcRenderer.invoke('pending-review:submit', request),
  context: (request) => ipcRenderer.invoke('pending-review:context', request)
}
