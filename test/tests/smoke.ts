// test/tests/smoke.ts
import {assert} from 'chai'
import {VERSION} from '$lib'

suite('smoke', function () {
    test('exports VERSION', function () {
        assert.equal(VERSION, '1.3.0')
    })
})
