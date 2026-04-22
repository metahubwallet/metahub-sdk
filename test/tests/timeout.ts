// test/tests/timeout.ts
import {assert} from 'chai'
import {MetahubError, MetahubErrorCode} from '$lib'
import {withTimeout} from '$lib/internal/withTimeout'

suite('withTimeout', function () {
    test('resolves when inner resolves before deadline', async function () {
        const result = await withTimeout(Promise.resolve(42), {timeoutMs: 100})
        assert.equal(result, 42)
    })

    test('rejects with Timeout code when inner hangs', async function () {
        const hung = new Promise(() => {})
        try {
            await withTimeout(hung, {timeoutMs: 20})
            assert.fail('should throw')
        } catch (e) {
            assert.instanceOf(e, MetahubError)
            assert.equal((e as MetahubError).code, MetahubErrorCode.Timeout)
        }
    })

    test('rejects with Aborted when signal fires', async function () {
        const ctrl = new AbortController()
        const hung = new Promise(() => {})
        const p = withTimeout(hung, {timeoutMs: 1000, signal: ctrl.signal})
        setTimeout(() => ctrl.abort(), 10)
        try {
            await p
            assert.fail('should throw')
        } catch (e) {
            assert.instanceOf(e, MetahubError)
            assert.equal((e as MetahubError).code, MetahubErrorCode.Aborted)
        }
    })

    test('signal already aborted rejects immediately', async function () {
        const ctrl = new AbortController()
        ctrl.abort()
        try {
            await withTimeout(new Promise(() => {}), {timeoutMs: 100, signal: ctrl.signal})
            assert.fail('should throw')
        } catch (e) {
            assert.equal((e as MetahubError).code, MetahubErrorCode.Aborted)
        }
    })
})
