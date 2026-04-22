export interface Network {
    blockchain: string
    chainId: string
    host: string
    port: number
    protocol: 'http' | 'https'
}

export interface Account {
    blockchain: string
    name: string
    publicKey: string
    authority: string
    chainId: string
    isHardware: boolean
}

export interface Identity {
    accounts: Account[]
    name: string
    publicKey: string
    hash: string
    kyc: boolean
}

export interface Token {
    blockchain: string
    contract: string
    symbol: string
    decimals: number
}

/**
 * An individual action payload. `data` may be either an object (serialized
 * using the matching ABI) or a pre-encoded hex string.
 */
export interface ActionInput {
    account: string
    name: string
    authorization: Array<{actor: string; permission: string}>
    data: Record<string, any> | string
}

/**
 * Full or partial Antelope Transaction. `actions` is required; TAPOS and
 * other header fields are optional — the wallet fills them if missing.
 */
export interface TransactionInput {
    actions: ActionInput[]
    expiration?: string
    ref_block_num?: number
    ref_block_prefix?: number
    max_net_usage_words?: number
    max_cpu_usage_ms?: number
    delay_sec?: number
    context_free_actions?: ActionInput[]
    transaction_extensions?: Array<[number, string]>
}

/**
 * First argument of the new transactArgs-based `requestSignature`:
 * a full transaction, an action list, or a single action.
 */
export type TransactArgsInput = TransactionInput | ActionInput[] | ActionInput

export interface TransactOptions {
    /** Overrides the client's default chainId. */
    chainId?: string
    /**
     * JSON ABIs keyed by contract account. Avoids a `get_raw_abi` round-trip
     * when the dApp already has them.
     */
    abis?: Record<string, any>
    /** TAPOS expiration window in seconds. Default: extension-side fallback. */
    expireSeconds?: number
    /** How far behind head block to anchor ref_block_num. Default: LIB. */
    blocksBehind?: number
    /** Forwarded to the handler; usually empty. */
    requiredKeys?: string[]
}

export interface TransactResult {
    signatures: string[]
    /** TAPOS-filled transaction (plain JSON) with human-readable action data. */
    transaction: any
    /** Final bytes that were signed. */
    serializedTransaction: number[]
}

export interface ArbitrarySignatureRequest {
    publicKey: string
    data: string
    chainId?: string
}
