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
})
