import { describe, expect, it, vi } from 'vitest'
import { findImportOnlyPaths } from './import-only-paths'

const base: Record<string, string> = {
  'src/moved.ts': "import { a } from './a'\nf(a)\n",
  'src/edited.ts': "import { a } from './a'\nf(a)\n",
  'src/huge.ts': `import { a } from './a'\n${'x'.repeat(300_000)}`
}
const current: Record<string, string> = {
  'src/moved.ts': "import { a } from '@/a'\nf(a)\n",
  'src/edited.ts': "import { a } from '@/a'\nf(a, 2)\n",
  'src/new.ts': "import { a } from '@/a'\n",
  'src/huge.ts': `import { a } from '@/a'\n${'x'.repeat(300_000)}`
}

describe('findImportOnlyPaths', () => {
  it('lists the files whose change against the base touches only imports', async () => {
    const readBase = vi.fn(async (path: string) => base[path] ?? null)
    const result = await findImportOnlyPaths({
      paths: ['src/moved.ts', 'src/edited.ts', 'src/new.ts', 'src/huge.ts', 'src/gone.ts'],
      readBase,
      readCurrent: async (path) => current[path] ?? null
    })

    expect(result).toEqual(['src/moved.ts'])
  })

  it('reads no more than its limit of files', async () => {
    const readBase = vi.fn(async () => null)
    await findImportOnlyPaths({
      paths: Array.from({ length: 500 }, (_, index) => `src/${index}.ts`),
      readBase,
      readCurrent: async () => null
    })

    expect(readBase).toHaveBeenCalledTimes(200)
  })
})
