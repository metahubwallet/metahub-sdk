// test/tests/client.ts
import {assert} from 'chai'
import sinon from 'sinon'
import {MetahubClient, MetahubError, MetahubErrorCode} from '$lib'
import type {Identity} from '$lib'
import {setupDom, DomHandle} from '$test/utils/dom'
import {createMockProvider} from '$test/utils/mock-provider'

suite('MetahubClient / connect', function () {
    let dom: DomHandle

    setup(() => {
        dom = setupDom()
    })
    teardown(() => {
        dom.teardown()
    })

    test('constructor accepts no options', function () {
        const c = new MetahubClient()
        assert.isFalse(c.connected)
        assert.isNull(c.identity)
        assert.isNull(c.version)
    })

    test('connect resolves ok when provider present', async function () {
        const mock = createMockProvider({version: '3.1.0'})
        dom.setProvider('metahub', mock)
        const c = new MetahubClient({connectTimeoutMs: 200})
        const res = await c.connect()
        assert.isTrue(res.ok)
        assert.equal(res.version, '3.1.0')
        assert.isTrue(c.connected)
        assert.equal(c.version, '3.1.0')
    })

    test('connect returns ok:false with NotInstalled reason on timeout', async function () {
        const c = new MetahubClient({connectTimeoutMs: 30})
        const res = await c.connect()
        assert.isFalse(res.ok)
        assert.equal(res.reason, MetahubErrorCode.NotInstalled)
        assert.isFalse(c.connected)
    })

    test('connect returns ok:false with Aborted reason when signal fires', async function () {
        const ctrl = new AbortController()
        const c = new MetahubClient({connectTimeoutMs: 1000})
        const promise = c.connect({signal: ctrl.signal})
        setTimeout(() => ctrl.abort(), 10)
        const res = await promise
        assert.isFalse(res.ok)
        assert.equal(res.reason, MetahubErrorCode.Aborted)
    })

    test('accepts injected provider (bypass discovery)', async function () {
        const mock = createMockProvider({version: '9.9.9'})
        const c = new MetahubClient({provider: mock})
        const res = await c.connect()
        assert.isTrue(res.ok)
        assert.equal(res.version, '9.9.9')
    })

    test('disconnect resets connected state', async function () {
        const mock = createMockProvider()
        const c = new MetahubClient({provider: mock})
        await c.connect()
        assert.isTrue(c.connected)
        c.disconnect()
        assert.isFalse(c.connected)
    })
})

const fakeIdentity: Identity = {
    accounts: [
        {
            blockchain: 'eos',
            name: 'alice',
            publicKey: 'EOS5...mock',
            authority: 'active',
            chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
            isHardware: false,
        },
    ],
    name: 'alice',
    publicKey: 'EOS5...mock',
    hash: 'hash123',
    kyc: false,
}

suite('MetahubClient / login-logout', function () {
    let dom: DomHandle
    setup(() => {
        dom = setupDom()
    })
    teardown(() => {
        dom.teardown()
    })

    test('login uses constructor options and emits identity', async function () {
        const mock = createMockProvider({identity: fakeIdentity})
        const loginSpy = sinon.spy(mock, 'login')
        const c = new MetahubClient({
            provider: mock,
            appName: 'mydapp',
            chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        })
        await c.connect()

        const emitted: Array<Identity | null> = []
        c.on('identity', (id) => emitted.push(id))

        const id = await c.login()
        assert.strictEqual(id, fakeIdentity)
        assert.equal(loginSpy.callCount, 1)
        assert.deepEqual(loginSpy.firstCall.args[0], {
            appName: 'mydapp',
            chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        })
        assert.deepEqual(emitted, [fakeIdentity])
    })

    test('login wraps provider errors into MetahubError', async function () {
        const mock = createMockProvider({
            throwOn: {login: {type: 'signature_rejected', message: 'user rejected'}},
        })
        const c = new MetahubClient({provider: mock, chainId: 'abc'})
        await c.connect()
        try {
            await c.login()
            assert.fail('should throw')
        } catch (e) {
            assert.instanceOf(e, MetahubError)
            assert.equal((e as MetahubError).code, MetahubErrorCode.UserRejected)
        }
    })

    test('login applies timeout', async function () {
        const mock = createMockProvider({identity: fakeIdentity, loginDelayMs: 200})
        const c = new MetahubClient({provider: mock, timeoutMs: 30, chainId: 'abc'})
        await c.connect()
        try {
            await c.login()
            assert.fail('should throw')
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.Timeout)
        }
    })

    test('logout accepts single account string', async function () {
        const mock = createMockProvider({identity: fakeIdentity})
        const logoutSpy = sinon.spy(mock, 'logout')
        const c = new MetahubClient({provider: mock})
        await c.connect()
        const identityEvents: Array<Identity | null> = []
        const logoutEvents: number[] = []
        c.on('identity', (id) => identityEvents.push(id))
        c.on('logout', () => logoutEvents.push(1))
        await c.logout('alice')
        assert.equal(logoutSpy.callCount, 1)
        assert.equal(logoutSpy.firstCall.args[0], 'alice')
        assert.deepEqual(logoutEvents, [1])
        assert.deepEqual(identityEvents, [null])
    })

    test('logout accepts array of accounts', async function () {
        const mock = createMockProvider({identity: fakeIdentity})
        const logoutSpy = sinon.spy(mock, 'logout')
        const c = new MetahubClient({provider: mock})
        await c.connect()
        await c.logout(['alice', 'bob'])
        assert.equal(logoutSpy.callCount, 1)
        assert.deepEqual(logoutSpy.firstCall.args[0], ['alice', 'bob'])
    })

    test('logout() without args calls provider.logout(undefined)', async function () {
        const mock = createMockProvider({identity: fakeIdentity})
        const logoutSpy = sinon.spy(mock, 'logout')
        const c = new MetahubClient({provider: mock})
        await c.connect()
        await c.logout()
        assert.equal(logoutSpy.callCount, 1)
        assert.isUndefined(logoutSpy.firstCall.args[0])
    })
})

suite('MetahubClient / queries', function () {
    let dom: DomHandle
    setup(() => {
        dom = setupDom()
    })
    teardown(() => {
        dom.teardown()
    })

    test('restore returns identity from provider.restore', async function () {
        const mock = createMockProvider({identity: fakeIdentity})
        const spy = sinon.spy(mock, 'restore')
        const c = new MetahubClient({provider: mock})
        await c.connect()
        const id = await c.restore()
        assert.strictEqual(id, fakeIdentity)
        assert.equal(spy.callCount, 1)
    })

    test('restore returns null when provider has no identity', async function () {
        const mock = createMockProvider({identity: null})
        const c = new MetahubClient({provider: mock})
        await c.connect()
        assert.isNull(await c.restore())
    })

    test('suggestNetwork resolves', async function () {
        const mock = createMockProvider()
        const c = new MetahubClient({provider: mock})
        await c.connect()
        await c.suggestNetwork({
            blockchain: 'eos',
            chainId: 'abc',
            host: 'eos.example',
            port: 443,
            protocol: 'https',
        })
    })

    test('getArbitrarySignature forwards publicKey + data', async function () {
        const mock = createMockProvider()
        const spy = sinon.spy(mock, 'getArbitrarySignature')
        const c = new MetahubClient({provider: mock})
        await c.connect()
        const sig = await c.getArbitrarySignature({publicKey: 'EOS_PK', data: 'hello'})
        assert.equal(sig, 'SIG_K1_mock_arbitrary')
        assert.deepEqual(spy.firstCall.args, ['EOS_PK', 'hello'])
    })

    test('getVersion returns provider version', async function () {
        const mock = createMockProvider({version: '3.2.1'})
        const c = new MetahubClient({provider: mock})
        await c.connect()
        assert.equal(await c.getVersion(), '3.2.1')
    })
})

suite('MetahubClient / requestSignature', function () {
    let dom: DomHandle
    setup(() => {
        dom = setupDom()
    })
    teardown(() => {
        dom.teardown()
    })

    const sampleAction = {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{actor: 'alice', permission: 'active'}],
        data: {from: 'alice', to: 'bob', quantity: '1.0000 EOS', memo: ''},
    }

    test('forwards a single action + options to provider.requestSignature', async function () {
        const mock = createMockProvider({
            response: {
                signatures: ['SIG_K1_tx'],
                transaction: {actions: [sampleAction], expiration: '2026-04-17T10:00:00'},
                serializedTransaction: [10, 20, 30],
            },
        })
        const spy = sinon.spy(mock, 'requestSignature')
        const c = new MetahubClient({provider: mock, chainId: 'def'})
        await c.connect()

        const res = await c.requestSignature(sampleAction, {abis: {'eosio.token': {version: 'x'}}})

        assert.deepEqual(res.signatures, ['SIG_K1_tx'])
        assert.deepEqual(res.serializedTransaction, [10, 20, 30])
        assert.equal(res.transaction.actions[0].name, 'transfer')

        assert.equal(spy.callCount, 1)
        assert.strictEqual(spy.firstCall.args[0], sampleAction)
        // options.chainId defaulted from the client constructor option
        assert.equal(spy.firstCall.args[1]!.chainId, 'def')
        assert.deepEqual(spy.firstCall.args[1]!.abis, {'eosio.token': {version: 'x'}})
    })

    test('accepts an actions array', async function () {
        const mock = createMockProvider()
        const spy = sinon.spy(mock, 'requestSignature')
        const c = new MetahubClient({provider: mock, chainId: 'c1'})
        await c.connect()
        await c.requestSignature([sampleAction, sampleAction])
        const firstArg = spy.firstCall.args[0] as any
        assert.isTrue(Array.isArray(firstArg))
        assert.equal(firstArg.length, 2)
    })

    test('accepts a full Transaction with explicit TAPOS', async function () {
        const mock = createMockProvider()
        const spy = sinon.spy(mock, 'requestSignature')
        const c = new MetahubClient({provider: mock, chainId: 'c1'})
        await c.connect()
        const tx = {
            actions: [sampleAction],
            expiration: '2026-04-17T10:00:00',
            ref_block_num: 1,
            ref_block_prefix: 2,
        }
        await c.requestSignature(tx, {expireSeconds: 60})
        assert.deepEqual(spy.firstCall.args[0], tx)
        assert.equal(spy.firstCall.args[1]!.expireSeconds, 60)
    })

    test('options.chainId overrides the client default', async function () {
        const mock = createMockProvider()
        const spy = sinon.spy(mock, 'requestSignature')
        const c = new MetahubClient({provider: mock, chainId: 'default'})
        await c.connect()
        await c.requestSignature(sampleAction, {chainId: 'override'})
        assert.equal(spy.firstCall.args[1]!.chainId, 'override')
    })

    test('propagates abi_unavailable as MetahubError.AbiUnavailable', async function () {
        const mock = createMockProvider({
            throwOn: {requestSignature: {type: 'abi_unavailable', message: 'eosio.token'}},
        })
        const c = new MetahubClient({provider: mock, chainId: 'c1'})
        await c.connect()
        try {
            await c.requestSignature(sampleAction)
            assert.fail()
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.AbiUnavailable)
        }
    })

    test('propagates bad_args as MetahubError.BadArgs', async function () {
        const mock = createMockProvider({
            throwOn: {requestSignature: {type: 'bad_args', message: 'missing actions'}},
        })
        const c = new MetahubClient({provider: mock, chainId: 'c1'})
        await c.connect()
        try {
            await c.requestSignature(sampleAction)
            assert.fail()
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.BadArgs)
        }
    })

    test('propagates user rejection as MetahubError.UserRejected', async function () {
        const mock = createMockProvider({
            throwOn: {requestSignature: {type: 'signature_rejected', message: 'no'}},
        })
        const c = new MetahubClient({provider: mock, chainId: 'c1'})
        await c.connect()
        try {
            await c.requestSignature(sampleAction)
            assert.fail()
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.UserRejected)
        }
    })

    test('honors timeout', async function () {
        const mock = createMockProvider({signDelayMs: 200})
        const c = new MetahubClient({provider: mock, chainId: 'c1', timeoutMs: 30})
        await c.connect()
        try {
            await c.requestSignature(sampleAction)
            assert.fail()
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.Timeout)
        }
    })

    test('auto-discovers the provider when called before connect (NotInstalled on discovery timeout)', async function () {
        // connect() is optional — methods lazy-discover on first use. When
        // no provider is injected into the window (setupDom leaves it empty),
        // discovery times out and surfaces NotInstalled.
        const c = new MetahubClient({connectTimeoutMs: 30})
        try {
            await c.requestSignature(sampleAction)
            assert.fail()
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.NotInstalled)
        }
    })

    test('auto-discovers when provider becomes available mid-flight', async function () {
        const mock = createMockProvider({
            response: {
                signatures: ['SIG_K1_auto'],
                transaction: {actions: [sampleAction]},
                serializedTransaction: [1, 2, 3],
            },
        })
        const c = new MetahubClient({chainId: 'c1'})
        // No explicit connect() — expose provider on window so discovery finds it.
        dom.setProvider('metahub', mock)
        const res = await c.requestSignature(sampleAction)
        assert.deepEqual(res.signatures, ['SIG_K1_auto'])
        assert.isTrue(c.connected)
    })

    test('throws InvalidRequest when provider lacks requestSignature', async function () {
        const rawProvider: any = {
            identity: null,
            async getVersion() {
                return '3.0.0'
            },
            async login() {
                return null as any
            },
            async logout() {
                return null
            },
            async restore() {
                return null
            },
            async suggestNetwork() {},
            async getArbitrarySignature() {
                return ''
            },
            // no requestSignature
        }
        const c = new MetahubClient({provider: rawProvider})
        await c.connect()
        try {
            await c.requestSignature(sampleAction)
            assert.fail()
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.InvalidRequest)
        }
    })
})
