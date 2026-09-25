import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { GitHubSlice } from './slice-types'
import type { GitHubCommentResult, PRComment } from '../../../../shared/github/comment-types'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '../../runtime/runtime-rpc-client'
import { prCommentsCacheSuffix, sourceScopedRepoCacheKey } from './cache-identity'
import { withBoundedCacheEntry } from './cache-policy'
import { hasUsableCommentPayload, mergePRCommentIntoList } from './pr-comment-cache'
import { getGitHubRepoSourceSettings, getGitHubWorkItemRequestContext } from './work-item-routing'

export const createReviewCommentCreateAction = (
  set: Parameters<StateCreator<AppState>>[0],
  get: Parameters<StateCreator<AppState>>[1]
): Pick<GitHubSlice, 'addPRReviewComment'> => ({
  // Why this exists beside the reply action: the main process, the RPC surface and the preload
  // bridge all already carry addPRReviewComment, but nothing in the renderer reached it -- so a
  // review could be read in Orca and only written on github.com.
  addPRReviewComment: async (repoPath, prNumber, body, options) => {
    const repo = get().repos?.find((candidate) =>
      options?.repoId ? candidate.id === options.repoId : candidate.path === repoPath
    )
    const repoId = options?.repoId ?? repo?.id
    const requestSettings = getGitHubRepoSourceSettings(
      get().settings,
      repo,
      options?.sourceContext
    )
    const cacheKey = sourceScopedRepoCacheKey(
      repoPath,
      repoId,
      prCommentsCacheSuffix(prNumber, options?.prRepo),
      requestSettings,
      repo?.connectionId,
      repo?.executionHostId,
      options?.sourceContext,
      repo !== undefined
    )
    const requestContext = getGitHubWorkItemRequestContext(
      get(),
      requestSettings,
      repoId ?? repoPath,
      repoPath,
      options?.sourceContext
    )
    let result: GitHubCommentResult
    try {
      result =
        requestContext.target.kind === 'environment'
          ? await callRuntimeRpc<GitHubCommentResult>(
              { kind: 'environment', environmentId: requestContext.target.environmentId },
              'github.addPRReviewComment',
              {
                repo: requestContext.target.runtimeRepoId,
                prNumber,
                commitId: options.commitId,
                path: options.path,
                line: options.line,
                startLine: options.startLine,
                body,
                prRepo: options?.prRepo ?? null
              },
              { timeoutMs: 30_000 }
            )
          : await window.api.gh.addPRReviewComment({
              repoPath,
              repoId,
              prNumber,
              commitId: options.commitId,
              path: options.path,
              line: options.line,
              startLine: options.startLine,
              body,
              prRepo: options?.prRepo ?? null,
              sourceContext: options?.sourceContext
            })
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to post review comment.'
      return { ok: false, error }
    }
    if (!hasUsableCommentPayload(result)) {
      return result.ok
        ? {
            ok: false,
            error: translate(
              'auto.store.slices.github.f129c42773',
              'GitHub did not return the new comment.'
            )
          }
        : result
    }
    const comment: PRComment = {
      ...result.comment,
      path: result.comment.path ?? options.path,
      line: result.comment.line ?? options.line
    }
    set((s) => {
      const entry = s.commentsCache[cacheKey]
      return {
        commentsCache: withBoundedCacheEntry(s.commentsCache, cacheKey, {
          data: mergePRCommentIntoList(entry?.data, comment),
          fetchedAt: Date.now()
        })
      }
    })
    return { ok: true, comment }
  }
})
