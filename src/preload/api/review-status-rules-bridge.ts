import { ipcRenderer } from 'electron'
import type { ReviewStatusRulesApi } from './review-status-rules-api'

export const reviewStatusRulesApi: ReviewStatusRulesApi = {
  snapshot: (request) => ipcRenderer.invoke('review-status-rules:snapshot', request)
}
