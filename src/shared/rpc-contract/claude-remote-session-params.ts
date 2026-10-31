import { z } from 'zod'

export const ClaudeRemoteSessionResolveUrl = z.object({
  sessionId: z.string().min(1).max(200)
})
