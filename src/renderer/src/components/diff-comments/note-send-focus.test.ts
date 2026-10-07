import { describe, expect, it } from 'vitest'
import { armNoteSendFocus, noteCreatedForSendFocus, takeNoteSendFocus } from './note-send-focus'

describe('note send focus', () => {
  it('hands focus to the note created right after Mod+Enter, once', () => {
    armNoteSendFocus(1_000)
    noteCreatedForSendFocus('note-1', 1_200)
    expect(takeNoteSendFocus('note-1')).toBe(true)
    expect(takeNoteSendFocus('note-1')).toBe(false)
  })

  it('ignores notes created without Mod+Enter', () => {
    noteCreatedForSendFocus('note-2', 50_000)
    expect(takeNoteSendFocus('note-2')).toBe(false)
  })

  it('arms only one note, and only within its window', () => {
    armNoteSendFocus(1_000)
    noteCreatedForSendFocus('late', 7_000)
    expect(takeNoteSendFocus('late')).toBe(false)

    armNoteSendFocus(10_000)
    noteCreatedForSendFocus('first', 10_100)
    noteCreatedForSendFocus('second', 10_200)
    expect(takeNoteSendFocus('first')).toBe(true)
    expect(takeNoteSendFocus('second')).toBe(false)
  })
})
