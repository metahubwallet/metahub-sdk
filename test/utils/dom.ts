type Listener = (event: {type: string}) => void

export interface DomHandle {
    setProvider(name: 'metahub' | 'scatter', provider: any): void
    clearProvider(name: 'metahub' | 'scatter'): void
    emit(type: string): void
    teardown(): void
}

export function setupDom(): DomHandle {
    const listeners: Record<string, Listener[]> = {}
    const g = globalThis as any

    g.document = {
        addEventListener(type: string, cb: Listener) {
            ;(listeners[type] = listeners[type] || []).push(cb)
        },
        removeEventListener(type: string, cb: Listener) {
            listeners[type] = (listeners[type] || []).filter((f) => f !== cb)
        },
    }
    g.window = g
    g.location = {host: 'test.local'}

    return {
        setProvider(name, provider) {
            g.window[name] = provider
        },
        clearProvider(name) {
            delete g.window[name]
        },
        emit(type) {
            ;(listeners[type] || []).forEach((cb) => cb({type}))
        },
        teardown() {
            delete g.document
            delete g.window
            delete g.location
            delete g.metahub
            delete g.scatter
        },
    }
}
