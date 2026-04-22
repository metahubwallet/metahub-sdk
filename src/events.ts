import type {Identity} from './types'

export type EventMap = {
    identity: (identity: Identity | null) => void
    logout: () => void
    unload: () => void
}

type Listeners<T> = {
    [K in keyof T]?: Array<T[K]>
}

export class Emitter<T extends Record<string, (...args: any[]) => void>> {
    private listeners: Listeners<T> = {}

    on<E extends keyof T>(event: E, listener: T[E]): () => void {
        const arr = (this.listeners[event] = this.listeners[event] || [])
        arr.push(listener)
        return () => this.off(event, listener)
    }

    off<E extends keyof T>(event: E, listener: T[E]): void {
        const arr = this.listeners[event]
        if (!arr) return
        const idx = arr.indexOf(listener)
        if (idx >= 0) arr.splice(idx, 1)
    }

    emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>): void {
        const arr = this.listeners[event]
        if (!arr) return
        for (const cb of [...arr]) {
            try {
                ;(cb as any)(...args)
            } catch {
                // swallow — emit must not throw
            }
        }
    }

    clear(): void {
        this.listeners = {}
    }
}
