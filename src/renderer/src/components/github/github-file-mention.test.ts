import { describe, expect, it } from 'vitest'
import { githubFileMentionContent, githubFileMentionTarget } from './github-file-mention'

// Why editor content, not markdown text: text typed into the editor is escaped when it is saved as
// markdown, which turned a mentioned file into a literal "\[\`path\`\](url)".
describe('githubFileMentionContent', () => {
  it("inserts the path as code linking the file on the pull request's branch", () => {
    expect(
      githubFileMentionContent('apps/frontend/a b.ts', {
        owner: 'acme',
        repo: 'app',
        ref: 'feature/x'
      })
    ).toEqual({
      type: 'text',
      text: 'apps/frontend/a b.ts',
      marks: [
        {
          type: 'link',
          attrs: { href: 'https://github.com/acme/app/blob/feature/x/apps/frontend/a%20b.ts' }
        },
        { type: 'code' }
      ]
    })
  })

  it('links on the GitHub Enterprise host the repository lives on', () => {
    expect(
      githubFileMentionContent('README.md', {
        host: 'git.corp.example',
        owner: 'acme',
        repo: 'app',
        ref: 'main'
      }).marks?.[0]
    ).toEqual({
      type: 'link',
      attrs: { href: 'https://git.corp.example/acme/app/blob/main/README.md' }
    })
  })

  it('names the file as code when there is no branch on GitHub to link to', () => {
    expect(githubFileMentionContent('README.md', null)).toEqual({
      type: 'text',
      text: 'README.md',
      marks: [{ type: 'code' }]
    })
  })
})

describe('githubFileMentionTarget', () => {
  it("prefers the pull request's head repository and branch, for a fork's pull request", () => {
    expect(
      githubFileMentionTarget(
        {
          headRefName: 'fix',
          prRepo: { owner: 'acme', repo: 'app' },
          headRepo: { owner: 'me', repo: 'app-fork' }
        },
        'local-branch'
      )
    ).toEqual({ owner: 'me', repo: 'app-fork', ref: 'fix' })
  })

  it("falls back to the workspace branch, and to nothing without the PR's repository", () => {
    expect(
      githubFileMentionTarget({ prRepo: { owner: 'acme', repo: 'app' } }, 'local-branch')
    ).toEqual({ owner: 'acme', repo: 'app', ref: 'local-branch' })
    expect(githubFileMentionTarget(null, 'local-branch')).toBeNull()
  })
})
