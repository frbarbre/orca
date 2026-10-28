import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'

type StepperEntry = { element: HTMLElement | null; open: () => void }

type ImageStepper = {
  register: (id: string, entry: StepperEntry) => () => void
  step: (id: string, delta: number) => boolean
}

const ImageStepperContext = createContext<ImageStepper | null>(null)

export function useNativeChatImageStepper(): ImageStepper | null {
  return useContext(ImageStepperContext)
}

function documentOrder(a: StepperEntry, b: StepperEntry): number {
  if (!a.element || !b.element) {
    return 0
  }
  return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}

// Why one per chat: arrow keys walk every image in the transcript, in the order they appear.
export function NativeChatImageStepperProvider({
  children
}: {
  children: ReactNode
}): React.JSX.Element {
  const entries = useRef(new Map<string, StepperEntry>())
  const stepper = useMemo<ImageStepper>(
    () => ({
      register: (id, entry) => {
        entries.current.set(id, entry)
        return () => {
          entries.current.delete(id)
        }
      },
      step: (id, delta) => {
        const ordered = [...entries.current.entries()]
          .filter(([key, entry]) => key === id || entry.element?.isConnected)
          .sort(([, a], [, b]) => documentOrder(a, b))
        const index = ordered.findIndex(([key]) => key === id)
        if (index < 0 || ordered.length < 2) {
          return false
        }
        ordered[(index + delta + ordered.length) % ordered.length][1].open()
        return true
      }
    }),
    []
  )
  return <ImageStepperContext.Provider value={stepper}>{children}</ImageStepperContext.Provider>
}
