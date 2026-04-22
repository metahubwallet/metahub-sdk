import {MetahubError, MetahubErrorCode} from './errors'
import type {
    Identity,
    Network,
    TransactArgsInput,
    TransactOptions,
    TransactResult,
} from './types'

/**
 * The surface exposed by `window.metahub` (or `window.scatter`) by the
 * Metahub browser extension. Mirrors `entrypoints/injected.ts`.
 *
 * `requestSignature(args, options)` is the transactArgs-based signing API
 * (mh_requestSignature on the wire). Older extension builds may not expose
 * it; in that case MetahubClient will surface a NotInstalled-style error.
 */
export interface MetahubProvider {
    readonly identity: Identity | null
    getVersion(): Promise<string>
    login(options: {appName: string; chainId: string}): Promise<Identity>
    logout(account?: string | string[]): Promise<Identity | null>
    restore(): Promise<Identity | null>
    suggestNetwork(network: Network): Promise<void>
    getArbitrarySignature(publicKey: string, data: string): Promise<string>
    requestSignature(args: TransactArgsInput, options?: TransactOptions): Promise<TransactResult>
}

export interface DiscoverOptions {
    timeoutMs?: number
    signal?: AbortSignal
}

function findInWindow(): MetahubProvider | undefined {
    const g = (typeof window !== 'undefined' ? window : globalThis) as any
    return (g.metahub as MetahubProvider) || (g.scatter as MetahubProvider) || undefined
}

export function discoverProvider(opts: DiscoverOptions = {}): Promise<MetahubProvider> {
    const {timeoutMs = 3000, signal} = opts

    const immediate = findInWindow()
    if (immediate) return Promise.resolve(immediate)

    if (signal?.aborted) {
        return Promise.reject(new MetahubError(MetahubErrorCode.Aborted, 'aborted'))
    }

    return new Promise<MetahubProvider>((resolve, reject) => {
        let done = false

        const check = () => {
            if (done) return
            const p = findInWindow()
            if (p) {
                done = true
                cleanup()
                resolve(p)
            }
        }

        const onAbort = () => {
            if (done) return
            done = true
            cleanup()
            reject(new MetahubError(MetahubErrorCode.Aborted, 'aborted'))
        }

        const timer = setTimeout(() => {
            if (done) return
            done = true
            cleanup()
            reject(
                new MetahubError(
                    MetahubErrorCode.NotInstalled,
                    `Metahub not detected after ${timeoutMs}ms`
                )
            )
        }, timeoutMs)

        function cleanup() {
            clearTimeout(timer)
            signal?.removeEventListener('abort', onAbort)
            if (typeof document !== 'undefined') {
                document.removeEventListener('metahubLoaded', check as any)
                document.removeEventListener('scatterLoaded', check as any)
            }
        }

        signal?.addEventListener('abort', onAbort)
        if (typeof document !== 'undefined') {
            document.addEventListener('metahubLoaded', check as any)
            document.addEventListener('scatterLoaded', check as any)
        }
        // re-check once in case provider appeared synchronously between the initial check
        // and event subscription
        check()
    })
}
