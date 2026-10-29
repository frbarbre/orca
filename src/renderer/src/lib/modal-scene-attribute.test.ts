// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { installModalSceneAttribute } from './modal-scene-attribute'

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  document.body.replaceChildren()
  delete document.body.dataset.modalScene
})

it.each([
  ['dialog-overlay', 'data-slot', 'dialog-overlay'],
  ['sheet-overlay', 'data-slot', 'sheet-overlay'],
  ['onboarding', 'data-onboarding-overlay', '']
])('marks the body while a %s is mounted on it', async (_label, attribute, value) => {
  const dispose = installModalSceneAttribute(document.body)
  const overlay = document.createElement('div')
  overlay.setAttribute(attribute, value)

  document.body.append(overlay)
  await flush()
  expect(document.body.hasAttribute('data-modal-scene')).toBe(true)

  overlay.remove()
  await flush()
  expect(document.body.hasAttribute('data-modal-scene')).toBe(false)
  dispose()
})

it('marks the body for an overlay mounted before install', () => {
  const overlay = document.createElement('div')
  overlay.setAttribute('data-slot', 'dialog-overlay')
  document.body.append(overlay)

  const dispose = installModalSceneAttribute(document.body)

  expect(document.body.hasAttribute('data-modal-scene')).toBe(true)
  dispose()
})

it('ignores an overlay nested below the body', async () => {
  const dispose = installModalSceneAttribute(document.body)
  const wrapper = document.createElement('div')
  const overlay = document.createElement('div')
  overlay.setAttribute('data-slot', 'dialog-overlay')
  wrapper.append(overlay)

  document.body.append(wrapper)
  await flush()

  expect(document.body.hasAttribute('data-modal-scene')).toBe(false)
  dispose()
})

it('stops tracking after dispose', async () => {
  const dispose = installModalSceneAttribute(document.body)
  dispose()
  const overlay = document.createElement('div')
  overlay.setAttribute('data-slot', 'dialog-overlay')

  document.body.append(overlay)
  await flush()

  expect(document.body.hasAttribute('data-modal-scene')).toBe(false)
})
