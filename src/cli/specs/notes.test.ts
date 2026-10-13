import { describe, expect, it } from 'vitest'
import { NOTES_COMMAND_SPECS } from './notes'

function spec(command: string) {
  const found = NOTES_COMMAND_SPECS.find((candidate) => candidate.path.join(' ') === command)
  if (!found) {
    throw new Error(`no spec for ${command}`)
  }
  return found
}

describe('notes command help', () => {
  it.each(['notes add', 'notes reply'])('%s says the body is markdown', (command) => {
    expect(spec(command).notes?.join(' ')).toContain('markdown')
  })

  it.each(['notes add', 'notes reply'])(
    '%s examples never put backticks inside double quotes, where the shell runs them',
    (command) => {
      for (const example of spec(command).examples ?? []) {
        expect(example).not.toMatch(/--body "[^"]*`/)
      }
    }
  )
})
