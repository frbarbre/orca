import { expect, it } from 'vitest'
import { rankQuickOpenFilesWithHistory } from './quick-open-history-ranking'
import { prepareQuickOpenFiles, rankQuickOpenFiles } from './quick-open-search'

it('puts recently visited matching files first, including empty queries', () => {
  const files = ['apps/api/.env', 'apps/web/.env', 'src/a.ts', 'src/b.ts']
  const history = ['src/b.ts', 'apps/web/.env', 'src/a.ts']
  expect(rankQuickOpenFilesWithHistory('', files, history).map((item) => item.path)).toEqual([
    'src/b.ts',
    'apps/web/.env',
    'src/a.ts',
    'apps/api/.env'
  ])
  expect(
    rankQuickOpenFilesWithHistory('.env api', files, history).map((item) => item.path)
  ).toEqual(['apps/api/.env'])
})

it('ranks a file whose name matches above a recent file that only matches its path', () => {
  const files = [
    'apps/backend/domain/ad_creative_source.py',
    'apps/backend/schema/service_result.py',
    'apps/backend/django/test_base.py',
    'apps/backend/domain/base.py',
    'apps/backend/schema/base.py'
  ]
  const history = [
    'apps/backend/domain/ad_creative_source.py',
    'apps/backend/schema/service_result.py',
    'apps/backend/schema/base.py'
  ]
  expect(rankQuickOpenFilesWithHistory('base.py', files, history).map((item) => item.path)).toEqual(
    [
      'apps/backend/schema/base.py',
      'apps/backend/domain/base.py',
      'apps/backend/django/test_base.py',
      'apps/backend/domain/ad_creative_source.py',
      'apps/backend/schema/service_result.py'
    ]
  )
})

it('ranks files in dependency folders after project files with the same name match', () => {
  const files = [
    'apps/backend/.venv/lib/python3.12/site-packages/storages/base.py',
    'web/node_modules/pkg/base.py',
    'apps/backend/test_infra/containers/base.py'
  ]
  expect(rankQuickOpenFilesWithHistory('base.py', files, []).map((item) => item.path)).toEqual([
    'apps/backend/test_infra/containers/base.py',
    'web/node_modules/pkg/base.py',
    'apps/backend/.venv/lib/python3.12/site-packages/storages/base.py'
  ])
})

it('prefers a name that starts with the query over one that only contains it', () => {
  const files = ['src/test_base.py', 'src/base_model.py']
  expect(rankQuickOpenFilesWithHistory('base', files, []).map((item) => item.path)).toEqual([
    'src/base_model.py',
    'src/test_base.py'
  ])
})

it('preserves ranking without history and excludes ignored/deleted unlisted history', () => {
  const files = ['src/a.ts', 'src/b.ts', 'apps/api/.env']
  expect(rankQuickOpenFilesWithHistory('a', files, [])).toEqual(
    rankQuickOpenFiles('a', prepareQuickOpenFiles(files))
  )
  expect(
    rankQuickOpenFilesWithHistory('', files, ['ignored.bin', 'missing.ts']).map((item) => item.path)
  ).not.toContain('ignored.bin')
})
