import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CommandHandler } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'

export const SETTINGS_TRANSFER_HANDLERS: Record<string, CommandHandler> = {
  'settings export': async (ctx) => {
    const { result } = await ctx.client.call<{ text: string }>('settingsTransfer.export')
    const output = getOptionalStringFlag(ctx.flags, 'output')
    if (!output) {
      console.log(result.text)
      return
    }
    const target = path.resolve(ctx.cwd, output)
    await writeFile(target, `${result.text}\n`, 'utf8')
    console.log(`Exported Orca settings to ${target}.`)
  },
  'settings import': async (ctx) => {
    const file = path.resolve(ctx.cwd, getRequiredStringFlag(ctx.flags, 'file'))
    const text = await readFile(file, 'utf8')
    const response = await ctx.client.call<{ summary: string }>('settingsTransfer.import', {
      text
    })
    printResult(
      response,
      ctx.json,
      ({ summary }) => `Imported ${summary} from ${file}. Orca is reloading.`
    )
  }
}
