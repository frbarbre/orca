import { ipcRenderer } from 'electron'
import type { PendingReviewApi } from './pending-review-api'

export const pendingReviewApi: PendingReviewApi = {
  submit: (request) => ipcRenderer.invoke('pending-review:submit', request),
  readDrafts: () => ipcRenderer.invoke('pending-review:drafts-read'),
  writeDrafts: (worktreeId, comments) =>
    ipcRenderer.invoke('pending-review:drafts-write', worktreeId, comments),
  readSummaries: () => ipcRenderer.invoke('pending-review:summaries-read'),
  writeSummary: (worktreeId, text) =>
    ipcRenderer.invoke('pending-review:summary-write', worktreeId, text),
  updateComment: (request) => ipcRenderer.invoke('pending-review:update-comment', request),
  resolveBase: (request) => ipcRenderer.invoke('pending-review:resolve-base', request),
  context: (request) => ipcRenderer.invoke('pending-review:context', request),
  uploadAsset: (request) => ipcRenderer.invoke('pending-review:asset-upload', request),
  resolveAssetUrl: (href) => ipcRenderer.invoke('pending-review:asset-resolve', href)
}
