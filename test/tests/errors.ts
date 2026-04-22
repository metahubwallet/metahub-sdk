// test/tests/errors.ts
import {assert} from 'chai'
import {MetahubError, MetahubErrorCode} from '$lib'

suite('MetahubError', function () {
    test('constructs with code and message', function () {
        const err = new MetahubError(MetahubErrorCode.Timeout, 'timed out')
        assert.equal(err.code, MetahubErrorCode.Timeout)
        assert.equal(err.message, 'timed out')
        assert.instanceOf(err, Error)
    })

    test('from() maps signature_rejected to UserRejected', function () {
        const err = MetahubError.from({type: 'signature_rejected', message: 'user denied'})
        assert.equal(err.code, MetahubErrorCode.UserRejected)
        assert.equal(err.message, 'user denied')
    })

    test('from() maps locked', function () {
        const err = MetahubError.from({type: 'locked', message: 'wallet locked'})
        assert.equal(err.code, MetahubErrorCode.Locked)
    })

    test('from() falls back to Unknown with cause preserved', function () {
        const raw = {foo: 'bar'}
        const err = MetahubError.from(raw)
        assert.equal(err.code, MetahubErrorCode.Unknown)
        assert.strictEqual(err.cause, raw)
    })

    test('from() passes through MetahubError untouched', function () {
        const original = new MetahubError(MetahubErrorCode.Timeout, 'x')
        const err = MetahubError.from(original)
        assert.strictEqual(err, original)
    })

    test('from() handles native Error with string message', function () {
        const raw = new Error('native boom')
        const err = MetahubError.from(raw)
        assert.equal(err.code, MetahubErrorCode.Unknown)
        assert.equal(err.message, 'native boom')
        assert.strictEqual(err.cause, raw)
    })
})
