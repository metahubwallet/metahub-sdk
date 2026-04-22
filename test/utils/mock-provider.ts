import type {Identity, MetahubProvider, TransactResult} from '$lib'

export type MockIdentity = Identity
export type MockProvider = MetahubProvider

export interface MockProviderOptions {
    identity?: Identity | null
    version?: string
    loginDelayMs?: number
    signDelayMs?: number
    signatures?: string[]
    /** Optional canned `requestSignature` response. */
    response?: Partial<TransactResult>
    throwOn?: Partial<Record<keyof MetahubProvider, any>>
}

export function createMockProvider(opts: MockProviderOptions = {}): MockProvider {
    const state: MockIdentity | null = opts.identity ?? null

    function maybeThrow<K extends keyof MockProvider>(key: K) {
        if (opts.throwOn && key in opts.throwOn) {
            throw opts.throwOn[key]
        }
    }

    const p: MockProvider = {
        get identity() {
            return state
        },
        async getVersion() {
            maybeThrow('getVersion')
            return opts.version ?? '3.0.0'
        },
        async login() {
            maybeThrow('login')
            if (opts.loginDelayMs) await new Promise((r) => setTimeout(r, opts.loginDelayMs))
            if (!state) throw {type: 'no_identity', message: 'no mock identity'}
            return state
        },
        async logout() {
            maybeThrow('logout')
            return null
        },
        async restore() {
            maybeThrow('restore')
            return state
        },
        async suggestNetwork(_: any) {
            maybeThrow('suggestNetwork')
        },
        async getArbitrarySignature() {
            maybeThrow('getArbitrarySignature')
            return 'SIG_K1_mock_arbitrary'
        },
        async requestSignature(_args: any, _options?: any) {
            maybeThrow('requestSignature')
            if (opts.signDelayMs) await new Promise((r) => setTimeout(r, opts.signDelayMs))
            return {
                signatures: opts.response?.signatures ?? opts.signatures ?? ['SIG_K1_mock'],
                transaction: opts.response?.transaction ?? {actions: []},
                serializedTransaction: opts.response?.serializedTransaction ?? [0, 0, 0],
            }
        },
    }
    return p
}
