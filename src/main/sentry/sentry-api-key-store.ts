import { createEncryptedApiKeyFileStore } from '../credentials/encrypted-api-key-file-store'

const store = createEncryptedApiKeyFileStore({
  fileName: 'sentry-api-key.enc',
  envelopePrefix: 'orca-sentry-api-key:v1:',
  providerLabel: 'Sentry',
  logScope: 'sentry'
})

export const hasSentryApiKey = store.has
export const saveSentryApiKey = store.save
export const readSentryApiKey = store.read
export const clearSentryApiKey = store.clear
