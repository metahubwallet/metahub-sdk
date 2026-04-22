// test/tests/events.ts
import {assert} from 'chai'
import sinon from 'sinon'
import {Emitter, EventMap} from '$lib'

suite('Emitter', function () {
    test('on + emit fires the listener with args', function () {
        const e = new Emitter<EventMap>()
        const cb = sinon.spy()
        e.on('logout', cb)
        e.emit('logout')
        assert.equal(cb.callCount, 1)
    })

    test('identity event passes identity', function () {
        const e = new Emitter<EventMap>()
        const cb = sinon.spy()
        e.on('identity', cb)
        e.emit('identity', null)
        assert.isTrue(cb.calledWith(null))
    })

    test('off() removes a specific listener', function () {
        const e = new Emitter<EventMap>()
        const cb = sinon.spy()
        e.on('logout', cb)
        e.off('logout', cb)
        e.emit('logout')
        assert.equal(cb.callCount, 0)
    })

    test('on() returns unsubscribe function', function () {
        const e = new Emitter<EventMap>()
        const cb = sinon.spy()
        const unsub = e.on('logout', cb)
        unsub()
        e.emit('logout')
        assert.equal(cb.callCount, 0)
    })

    test('clear() removes all listeners', function () {
        const e = new Emitter<EventMap>()
        const a = sinon.spy()
        const b = sinon.spy()
        e.on('logout', a)
        e.on('identity', b)
        e.clear()
        e.emit('logout')
        e.emit('identity', null)
        assert.equal(a.callCount, 0)
        assert.equal(b.callCount, 0)
    })

    test('listener throw does not prevent other listeners', function () {
        const e = new Emitter<EventMap>()
        const a = () => {
            throw new Error('boom')
        }
        const b = sinon.spy()
        e.on('logout', a)
        e.on('logout', b)
        e.emit('logout')
        assert.equal(b.callCount, 1)
    })
})
