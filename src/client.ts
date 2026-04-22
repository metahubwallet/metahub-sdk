import {MetahubError, MetahubErrorCode} from './errors'
import {Emitter, EventMap} from './events'
import {withTimeout} from './internal/withTimeout'
import {discoverProvider, MetahubProvider} from './provider'
import type {
    ArbitrarySignatureRequest,
    Identity,
    Network,
    TransactArgsInput,
    TransactOptions,
    TransactResult,
} from './types'

export interface MetahubClientOptions {
    appName?: string
    chainId?: string
    timeoutMs?: number
    connectTimeoutMs?: number
    provider?: MetahubProvider
}

export interface ConnectResult {
    ok: boolean
    version?: string
    reason?: MetahubErrorCode
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_CONNECT_TIMEOUT_MS = 3_000

export class MetahubClient {
    private readonly options: MetahubClientOptions
    private readonly emitter = new Emitter<EventMap>()
    private provider: MetahubProvider | null = null
    private pendingProvider: Promise<MetahubProvider> | null = null
    private _version: string | null = null

    constructor(options: MetahubClientOptions = {}) {
        this.options = options
    }

    get identity(): Identity | null {
        return this.provider ? this.provider.identity : null
    }

    get connected(): boolean {
        return this.provider !== null
    }

    get version(): string | null {
        return this._version
    }

    /**
     * Eagerly discover and bind the extension provider. Optional: every other
     * method on this client will auto-discover on first use via
     * `ensureProvider()`. Use `connect()` when you want to surface discovery
     * failures up-front (e.g. to prompt the user to install the extension)
     * before attempting a login or signature.
     */
    async connect(options: {signal?: AbortSignal} = {}): Promise<ConnectResult> {
        try {
            await this.ensureProvider(options.signal)
            return {ok: true, version: this._version ?? undefined}
        } catch (e) {
            const err = MetahubError.from(e)
            return {ok: false, reason: err.code}
        }
    }

    disconnect(): void {
        this.provider = null
        this.pendingProvider = null
        this._version = null
        this.emitter.clear()
    }

    async login(options: {appName?: string; chainId?: string} = {}): Promise<Identity> {
        const provider = await this.ensureProvider()
        const appName =
            options.appName ??
            this.options.appName ??
            (typeof location !== 'undefined' ? location.host : '')
        const chainId = options.chainId ?? this.options.chainId ?? ''
        try {
            const identity = await withTimeout(provider.login({appName, chainId}), {
                timeoutMs: this.rpcTimeout(),
            })
            this.emitter.emit('identity', identity)
            return identity
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    async logout(account?: string | string[]): Promise<Identity | null> {
        const provider = await this.ensureProvider()
        try {
            const result = await withTimeout(provider.logout(account), {
                timeoutMs: this.rpcTimeout(),
            })
            this.emitter.emit('logout')
            this.emitter.emit('identity', null)
            return result
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    async restore(): Promise<Identity | null> {
        const provider = await this.ensureProvider()
        try {
            const id = await withTimeout(provider.restore(), {
                timeoutMs: this.rpcTimeout(),
            })
            if (id) this.emitter.emit('identity', id)
            return id
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    async suggestNetwork(network: Network): Promise<void> {
        const provider = await this.ensureProvider()
        try {
            await withTimeout(provider.suggestNetwork(network), {timeoutMs: this.rpcTimeout()})
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    async getArbitrarySignature(req: ArbitrarySignatureRequest): Promise<string> {
        const provider = await this.ensureProvider()
        try {
            return await withTimeout(
                provider.getArbitrarySignature(req.publicKey, req.data),
                {timeoutMs: this.rpcTimeout()}
            )
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    async getVersion(): Promise<string> {
        const provider = await this.ensureProvider()
        try {
            const v = await withTimeout(provider.getVersion(), {timeoutMs: this.rpcTimeout()})
            this._version = v
            return v
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    /**
     * Sign a transaction. Forwards to the extension's
     * `window.metahub.requestSignature(args, options)` (mh_requestSignature
     * on the wire). `args` may be a partial Transaction, an Action[] array,
     * or a single Action. The wallet fills TAPOS, resolves ABIs, serializes,
     * and returns signatures plus the final transaction / bytes.
     *
     * options.chainId defaults to the client's configured chainId.
     */
    async requestSignature(
        args: TransactArgsInput,
        options: TransactOptions = {}
    ): Promise<TransactResult> {
        const provider = await this.ensureProvider()
        const chainId = options.chainId ?? this.options.chainId
        const merged: TransactOptions = chainId ? {...options, chainId} : options
        try {
            return await withTimeout(this.invokeSign(provider, args, merged), {
                timeoutMs: this.rpcTimeout(),
            })
        } catch (e) {
            throw MetahubError.from(e)
        }
    }

    private async invokeSign(
        provider: MetahubProvider,
        args: TransactArgsInput,
        options: TransactOptions
    ): Promise<TransactResult> {
        if (typeof provider.requestSignature !== 'function') {
            throw new MetahubError(
                MetahubErrorCode.InvalidRequest,
                'Provider does not expose requestSignature(args, options). ' +
                    'Update the Metahub extension to a version that supports transactArgs.'
            )
        }
        return provider.requestSignature(args, options)
    }

    on<E extends keyof EventMap>(event: E, listener: EventMap[E]): () => void {
        return this.emitter.on(event, listener)
    }

    off<E extends keyof EventMap>(event: E, listener: EventMap[E]): void {
        this.emitter.off(event, listener)
    }

    /**
     * Lazy provider resolution. Returns the cached provider if one is already
     * bound; otherwise runs discovery (with the same timeout / signal plumbing
     * connect() uses) and caches the result. All public RPC methods go through
     * this — calling connect() first is optional.
     *
     * Concurrent callers share a single in-flight discovery promise so we
     * don't kick off parallel window.metahub scans.
     */
    protected async ensureProvider(signal?: AbortSignal): Promise<MetahubProvider> {
        if (this.provider) return this.provider
        if (!this.pendingProvider) {
            this.pendingProvider = (async () => {
                const provider =
                    this.options.provider ??
                    (await discoverProvider({
                        timeoutMs: this.options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
                        signal,
                    }))
                this.provider = provider
                try {
                    this._version = await provider.getVersion()
                } catch {
                    this._version = null
                }
                return provider
            })()
            this.pendingProvider.catch(() => {
                // Reset so the next call gets a fresh discovery attempt.
                this.pendingProvider = null
            })
        }
        return this.pendingProvider
    }

    protected rpcTimeout(): number {
        return this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    }

    protected get _options(): MetahubClientOptions {
        return this.options
    }

    protected get _emitter(): Emitter<EventMap> {
        return this.emitter
    }
}
