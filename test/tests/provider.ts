// test/tests/provider.ts
import {assert} from 'chai'
import {MetahubError, MetahubErrorCode} from '$lib'
import {discoverProvider} from '$lib/provider'
import {setupDom, DomHandle} from '$test/utils/dom'
import {createMockProvider} from '$test/utils/mock-provider'

suite('discoverProvider', function () {
    let dom: DomHandle

    setup(function () {
        dom = setupDom()
    })

    teardown(function () {
        dom.teardown()
    })

    test('resolves immediately when window.metahub already present', async function () {
        const mock = createMockProvider()
        dom.setProvider('metahub', mock)
        const p = await discoverProvider({timeoutMs: 1000})
        assert.strictEqual(p, mock)
    })

    test('falls back to window.scatter', async function () {
        const mock = createMockProvider()
        dom.setProvider('scatter', mock)
        const p = await discoverProvider({timeoutMs: 1000})
        assert.strictEqual(p, mock)
    })

    test('resolves when metahubLoaded event fires', async function () {
        const mock = createMockProvider()
        const promise = discoverProvider({timeoutMs: 1000})
        setTimeout(() => {
            dom.setProvider('metahub', mock)
            dom.emit('metahubLoaded')
        }, 20)
        const p = await promise
        assert.strictEqual(p, mock)
    })

    test('rejects with NotInstalled after timeout', async function () {
        try {
            await discoverProvider({timeoutMs: 50})
            assert.fail('should throw')
        } catch (e) {
            assert.instanceOf(e, MetahubError)
            assert.equal((e as MetahubError).code, MetahubErrorCode.NotInstalled)
        }
    })

    test('rejects with Aborted when signal fires', async function () {
        const ctrl = new AbortController()
        const promise = discoverProvider({timeoutMs: 1000, signal: ctrl.signal})
        setTimeout(() => ctrl.abort(), 20)
        try {
            await promise
            assert.fail('should throw')
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.Aborted)
        }
    })
})
