import type { Root, RootContent } from 'mdast'

export const GITHUB_MENTION_PROPERTY = 'dataGithubMention'

type MentionNode = {
  type: 'githubMention'
  data: { hName: 'span'; hProperties: Record<string, string> }
  children: [{ type: 'text'; value: string }]
}

type SplitNode = MentionNode | { type: 'text'; value: string }

const MENTION_PATTERN = /(?<![\w@/.-])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(?![\w/@-]|\.\w)/g

export function splitGitHubMentions(value: string): SplitNode[] {
  const parts: SplitNode[] = []
  let cursor = 0
  for (const match of value.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0
    const login = match[1]
    if (!login) {
      continue
    }
    if (index > cursor) {
      parts.push({ type: 'text', value: value.slice(cursor, index) })
    }
    parts.push({
      type: 'githubMention',
      data: { hName: 'span', hProperties: { [GITHUB_MENTION_PROPERTY]: login } },
      children: [{ type: 'text', value: match[0] }]
    })
    cursor = index + match[0].length
  }
  if (cursor === 0) {
    return [{ type: 'text', value }]
  }
  if (cursor < value.length) {
    parts.push({ type: 'text', value: value.slice(cursor) })
  }
  return parts
}

type ParentNode = { type: string; children?: RootContent[] }

function transform(node: ParentNode): void {
  if (!node.children || node.type === 'link' || node.type === 'linkReference') {
    return
  }
  const next: RootContent[] = []
  for (const child of node.children) {
    if (child.type === 'text') {
      for (const part of splitGitHubMentions(child.value)) {
        next.push(part as RootContent)
      }
    } else {
      transform(child as ParentNode)
      next.push(child)
    }
  }
  node.children = next
}

export function remarkGitHubMentions(): (tree: Root) => void {
  return (tree) => transform(tree)
}
