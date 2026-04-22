# @metahubwallet/sdk

Typed browser SDK for the [MetaHub](https://wallet.metahub-ai.com) wallet extension.

## Install

```bash
npm install @metahubwallet/sdk
```

## Usage

```ts
import {MetahubClient} from '@metahubwallet/sdk'

const client = new MetahubClient({
    appName: 'my-dapp',
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
})

// connect() is optional — login() / requestSignature() / etc. auto-discover
// the extension provider on first use. Call it up-front only when you want to
// handle "wallet not installed" errors separately from the first signing
// prompt (e.g. to show a custom install CTA).
const identity = await client.login()
console.log(identity.accounts)

client.on('identity', (id) => {
    console.log('identity changed', id)
})
```

### Optional eager connect

```ts
import {MetahubErrorCode} from '@metahubwallet/sdk'

const res = await client.connect()
if (!res.ok && res.reason === MetahubErrorCode.NotInstalled) {
    // Prompt user to install MetaHub
    return
}
```

### Signing transactions

Pass actions or a partial `Transaction`; the wallet fills in TAPOS,
serializes using its own ABI cache (or the ABIs you supply), and
prompts the user. Returns the TAPOS-filled transaction plus the final
signed bytes.

```ts
const action = {
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{actor: identity.name, permission: 'active'}],
    data: {
        from: identity.name,
        to: 'bob',
        quantity: '1.0000 EOS',
        memo: '',
    },
}

// `args` accepts a single Action, an Action[], or a full Transaction.
const {signatures, transaction, serializedTransaction} =
    await client.requestSignature(action, {
        // Optional — defaults to the client's configured chainId
        chainId: customChainId,
        // Optional — pre-supplied ABIs skip the wallet's RPC lookup
        abis: {'eosio.token': tokenAbiJson},
        // Optional TAPOS hints (used only when TAPOS is missing on the transaction)
        expireSeconds: 60,
        blocksBehind: 3,
    })
```

### Arbitrary-string signatures

```ts
const sig = await client.getArbitrarySignature({
    publicKey: identity.publicKey,
    data: 'hello world',
})
```

## API

- `new MetahubClient(options?)` — construct a client. Options: `appName`, `chainId`, `timeoutMs`, `connectTimeoutMs`, `provider` (inject for tests).
- `connect({signal?}): Promise<{ok, version?, reason?}>` — wait for the injected provider.
- `disconnect()` — reset state + clear event listeners.
- `login({appName?, chainId?})` → `Identity` — per-call options override constructor options.
- `logout(account?: string | string[])` → `Identity | null` — log out one or multiple accounts.
- `restore()` → `Identity | null` — restore identity from prior-session permissions (no user prompt).
- `suggestNetwork(network)` → `void`
- `getArbitrarySignature({publicKey, data, chainId?})` → `string`
- `requestSignature(args: Transaction | Action[] | Action, options?)` → `{signatures, transaction, serializedTransaction}` — transactArgs-based signing (requires extension v3.0.0+).
- `getVersion()` → `string`
- `on('identity' | 'logout' | 'unload', cb)` → unsubscribe fn

Read-only getters:

- `client.identity` → `Identity | null` — the current identity, or `null` before login / after logout.
- `client.connected` → `boolean` — whether a provider has been bound.
- `client.version` → `string | null` — cached extension version (populated on first provider resolution).

Also exported from the package root: `discoverProvider`, `MetahubError`, `MetahubErrorCode`, `Emitter`, `VERSION`, and the `MetahubProvider` / `DiscoverOptions` / `EventMap` / `MetahubClientOptions` / `ConnectResult` types.

Errors thrown from any RPC method are instances of `MetahubError` with a typed `code: MetahubErrorCode`. Includes `BadArgs`, `AbiUnavailable`, `UserRejected`, `Locked`, `NotInstalled`, `Timeout`, `InvalidRequest`.

## License

MIT
