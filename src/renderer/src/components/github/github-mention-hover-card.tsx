import { useState, type ComponentPropsWithoutRef } from 'react'
import { Building2, ExternalLink, MapPin } from 'lucide-react'
import type { ExtraProps } from 'react-markdown'
import type { CommentMarkdownExtension } from '@/components/sidebar/CommentMarkdown'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { translate } from '@/i18n/i18n'
import type { GitHubUserProfile } from '../../../../shared/github/github-user-profile'
import { GitHubUserAvatar } from './github-user-avatar'
import { GITHUB_MENTION_PROPERTY, remarkGitHubMentions } from './github-mention-markdown'

type ProfileState = GitHubUserProfile | 'loading' | 'unavailable'

const profiles = new Map<string, Promise<GitHubUserProfile | null>>()

function loadProfile(login: string): Promise<GitHubUserProfile | null> {
  const key = login.toLowerCase()
  let pending = profiles.get(key)
  if (!pending) {
    pending = window.api.pendingReview.userProfile(login).catch(() => null)
    profiles.set(key, pending)
  }
  return pending
}

function ProfileCard({ login, state }: { login: string; state: ProfileState }): React.JSX.Element {
  if (state === 'loading' || state === 'unavailable') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <GitHubUserAvatar login={login} className="size-8" />
        <div className="min-w-0">
          <div className="font-medium text-foreground">{login}</div>
          {state === 'loading'
            ? translate('auto.components.github.mentionCard.loading', 'Loading…')
            : translate(
                'auto.components.github.mentionCard.unavailable',
                "Couldn't load this profile"
              )}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <GitHubUserAvatar
          login={state.login}
          name={state.name}
          avatarUrl={state.avatarUrl}
          className="size-10"
        />
        <div className="min-w-0">
          {state.name && (
            <div className="truncate text-sm font-semibold text-foreground">{state.name}</div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="truncate">{state.login}</span>
            {state.isBot && (
              <span className="rounded border border-border px-1 text-[10px]">
                {translate('auto.components.github.mentionCard.bot', 'Bot')}
              </span>
            )}
          </div>
        </div>
      </div>
      {state.bio && <p className="text-foreground">{state.bio}</p>}
      {(state.company || state.location) && (
        <div className="flex flex-col gap-1 text-muted-foreground">
          {state.company && (
            <span className="flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">{state.company}</span>
            </span>
          )}
          {state.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{state.location}</span>
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        className="flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => void window.api.shell.openUrl(state.url)}
      >
        <ExternalLink className="size-3.5" />
        {translate('auto.components.github.mentionCard.openProfile', 'Open profile on GitHub')}
      </button>
    </div>
  )
}

function GitHubMention({ login }: { login: string }): React.JSX.Element {
  const [state, setState] = useState<ProfileState>('loading')
  return (
    <HoverCard
      openDelay={300}
      closeDelay={100}
      onOpenChange={(open) => {
        if (open) {
          void loadProfile(login).then((profile) => setState(profile ?? 'unavailable'))
        }
      }}
    >
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          data-github-mention={login}
          className="cursor-default rounded-sm font-semibold text-foreground hover:underline"
        >
          @{login}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start">
        <ProfileCard login={login} state={state} />
      </HoverCardContent>
    </HoverCard>
  )
}

type SpanProps = ComponentPropsWithoutRef<'span'> & ExtraProps

function MentionSpan({ node: _node, ...props }: SpanProps): React.JSX.Element {
  const login = 'data-github-mention' in props ? props['data-github-mention'] : undefined
  if (typeof login !== 'string' || !login) {
    return <span {...props} />
  }
  return <GitHubMention login={login} />
}

export const githubMentionMarkdownExtension: CommentMarkdownExtension = {
  remarkPlugins: [remarkGitHubMentions],
  sanitizeAttributes: { span: [GITHUB_MENTION_PROPERTY] },
  components: { span: MentionSpan }
}
