import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import {
  resolveSourceControlAiInstructions,
  resolveSourceControlAiPrCreationDefaults
} from '../../../../shared/source-control-ai'
import { buildWorkspaceActionSkills } from '../../../../shared/workspace-action-skills'

export function useWorkspaceActionSkillsSync(): void {
  const ready = useAppStore((s) => s.persistedUIReady)
  const actionPrompts = useAppStore((s) => s.workspaceStatusRules.actionPrompts)
  const reviewInbox = useAppStore((s) => s.workspaceStatusRules.reviewInbox)
  const settings = useAppStore((s) => s.settings)
  const lastSent = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || !settings) {
      return
    }
    const prDefaults = resolveSourceControlAiPrCreationDefaults({ settings })
    const skills = buildWorkspaceActionSkills(
      { actionPrompts, reviewInbox },
      {
        draft: prDefaults.draft,
        useTemplate: prDefaults.useTemplate,
        prInstructions: resolveSourceControlAiInstructions({ settings, operation: 'pullRequest' })
      }
    )
    const serialized = JSON.stringify(skills)
    if (serialized === lastSent.current) {
      return
    }
    lastSent.current = serialized
    window.api.reviewStatusRules.syncActionSkills(skills).catch(console.error)
  }, [ready, actionPrompts, reviewInbox, settings])
}
