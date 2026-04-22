import {MetahubError, MetahubErrorCode} from '../errors'

export interface WithTimeoutOptions {
    timeoutMs: number
    signal?: AbortSignal
    /** Error code used when timeoutMs elapses. Default: Timeout. */
    timeoutCode?: MetahubErrorCode
}

export function withTimeout<T>(inner: Promise<T>, opts: WithTimeoutOptions): Promise<T> {
    const {timeoutMs, signal, timeoutCode = MetahubErrorCode.Timeout} = opts

    if (signal?.aborted) {
        return Promise.reject(new MetahubError(MetahubErrorCode.Aborted, 'aborted'))
    }

    return new Promise<T>((resolve, reject) => {
        let done = false
        const timer = setTimeout(() => {
            if (done) return
            done = true
            cleanup()
            reject(new MetahubError(timeoutCode, `timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        const onAbort = () => {
            if (done) return
            done = true
            cleanup()
            reject(new MetahubError(MetahubErrorCode.Aborted, 'aborted'))
        }
        signal?.addEventListener('abort', onAbort)

        function cleanup() {
            clearTimeout(timer)
            signal?.removeEventListener('abort', onAbort)
        }

        inner.then(
            (v) => {
                if (done) return
                done = true
                cleanup()
                resolve(v)
            },
            (e) => {
                if (done) return
                done = true
                cleanup()
                reject(e)
            }
        )
    })
}
