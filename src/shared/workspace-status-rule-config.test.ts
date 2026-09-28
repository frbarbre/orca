import { describe, expect, it } from 'vitest'
import {
  cloneDefaultWorkspaceStatusRuleConfig,
  normalizeWorkspaceStatusRuleConfig
} from './workspace-status-rule-config'

describe('normalizeWorkspaceStatusRuleConfig', () => {
  it('discards a ledger written before the seeding step was removed', () => {
    const config = normalizeWorkspaceStatusRuleConfig({
      ...cloneDefaultWorkspaceStatusRuleConfig(),
      handledPullRequests: ['flowbasedk/flowbase#3170'],
      ledgerVersion: undefined
    })

    expect(config.handledPullRequests).toEqual([])
  })

  it('keeps a ledger written by this version', () => {
    const config = normalizeWorkspaceStatusRuleConfig({
      ...cloneDefaultWorkspaceStatusRuleConfig(),
      handledPullRequests: ['flowbasedk/flowbase#3170']
    })

    expect(config.handledPullRequests).toEqual(['flowbasedk/flowbase#3170'])
  })

  it('stamps the ledger version on a fresh config', () => {
    expect(normalizeWorkspaceStatusRuleConfig({}).ledgerVersion).toBe(1)
  })

  it('ignores the removed seeded flag without losing the rest', () => {
    const config = normalizeWorkspaceStatusRuleConfig({
      ...cloneDefaultWorkspaceStatusRuleConfig(),
      reviewInbox: { enabled: true, agent: 'claude', promptTemplate: 'x', seeded: true }
    })

    expect(config.reviewInbox.enabled).toBe(true)
    expect('seeded' in config.reviewInbox).toBe(false)
  })

  it('keeps the new-workspace column with the time it was chosen', () => {
    const config = normalizeWorkspaceStatusRuleConfig({
      newWorkspaceStatus: ' todo ',
      newWorkspaceStatusSince: 1_700_000_000_000
    })

    expect(config.newWorkspaceStatus).toBe('todo')
    expect(config.newWorkspaceStatusSince).toBe(1_700_000_000_000)
  })

  it('clears the new-workspace time when no column is chosen', () => {
    const config = normalizeWorkspaceStatusRuleConfig({
      newWorkspaceStatus: '',
      newWorkspaceStatusSince: 1_700_000_000_000
    })

    expect(config.newWorkspaceStatus).toBeNull()
    expect(config.newWorkspaceStatusSince).toBeNull()
  })
})
