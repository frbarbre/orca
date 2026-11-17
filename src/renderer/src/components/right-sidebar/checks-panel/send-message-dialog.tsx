import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'

export type SendMessageRequest = { count: number; send: (message: string) => void }

export function useSendMessageRequest<T>(send: (items: T[], message: string) => void): {
  request: SendMessageRequest | null
  ask: (items: T[]) => void
  cancel: () => void
} {
  const [request, setRequest] = useState<SendMessageRequest | null>(null)
  const ask = (items: T[]): void =>
    setRequest({
      count: items.length,
      send: (message) => {
        setRequest(null)
        send(items, message)
      }
    })
  return { request, ask, cancel: () => setRequest(null) }
}

// Fork: queued comments go to the agent only after a chance to put a message in front of them.
export function SendMessageDialog({
  request,
  onCancel
}: {
  request: SendMessageRequest | null
  onCancel: () => void
}): React.JSX.Element {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {request ? <SendMessageForm request={request} onCancel={onCancel} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function SendMessageForm({
  request,
  onCancel
}: {
  request: SendMessageRequest
  onCancel: () => void
}): React.JSX.Element {
  const [message, setMessage] = useState('')
  const send = (): void => request.send(message)
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate('queuedComments.send', 'Send {{count}} queued comments', {
            count: request.count
          })}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'queuedComments.messageDescription',
            'Add a message for the agent (optional). Enter sends, Shift+Enter adds a line.'
          )}
        </DialogDescription>
      </DialogHeader>
      <Textarea
        autoFocus
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send()
          }
        }}
        aria-label={translate('queuedComments.messageLabel', 'Message for the agent')}
        placeholder={translate('queuedComments.messagePlaceholder', 'Add a message (optional)')}
      />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {translate('queuedComments.messageCancel', 'Cancel')}
        </Button>
        <Button type="button" onClick={send}>
          {translate('queuedComments.messageSend', 'Send')}
        </Button>
      </DialogFooter>
    </>
  )
}
