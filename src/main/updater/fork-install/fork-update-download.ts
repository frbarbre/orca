import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { get } from 'node:https'
import type { IncomingMessage } from 'node:http'

const MAX_REDIRECTS = 5

function request(url: string, redirectsLeft: number): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    get(url, { headers: { 'user-agent': 'orca-fork-updater' } }, (response) => {
      const location = response.headers.location
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        location
      ) {
        response.resume()
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects while fetching the update.'))
          return
        }
        resolve(request(new URL(location, url).toString(), redirectsLeft - 1))
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`The update download answered ${response.statusCode}.`))
        return
      }
      resolve(response)
    }).on('error', reject)
  })
}

export async function fetchForkUpdateText(url: string): Promise<string> {
  const response = await request(url, MAX_REDIRECTS)
  response.setEncoding('utf8')
  let body = ''
  for await (const chunk of response) {
    body += chunk
  }
  return body
}

/**
 * Downloads an update archive and refuses one whose hash does not match the manifest.
 *
 * Why the hash is load-bearing here and nowhere else: a signed build has Squirrel checking the
 * code signature before it swaps anything. This one has no signature to check, so the sha512
 * electron-builder wrote into `latest-mac.yml` is the only thing standing between a corrupted or
 * substituted archive and a bundle that replaces the running app.
 */
export async function downloadForkUpdateArchive(args: {
  url: string
  destination: string
  expectedSha512: string
  expectedSize: number
  onProgress?: (percent: number) => void
}): Promise<void> {
  const response = await request(args.url, MAX_REDIRECTS)
  const hash = createHash('sha512')
  const file = createWriteStream(args.destination)
  const total = Number(response.headers['content-length'] ?? args.expectedSize) || args.expectedSize
  let received = 0
  let lastReported = -1
  try {
    await new Promise<void>((resolve, reject) => {
      response.on('data', (chunk: Buffer) => {
        hash.update(chunk)
        received += chunk.length
        const percent = total > 0 ? Math.min(99, Math.floor((received / total) * 100)) : 0
        if (percent !== lastReported) {
          lastReported = percent
          args.onProgress?.(percent)
        }
      })
      response.on('error', reject)
      file.on('error', reject)
      file.on('finish', resolve)
      response.pipe(file)
    })
    const actual = hash.digest('base64')
    if (actual !== args.expectedSha512) {
      throw new Error('The downloaded update did not match the checksum in the release manifest.')
    }
  } catch (error) {
    await rm(args.destination, { force: true })
    throw error
  }
}
