export enum MetahubErrorCode {
    NotInstalled = 'NOT_INSTALLED',
    Aborted = 'ABORTED',
    Timeout = 'TIMEOUT',
    UserRejected = 'USER_REJECTED',
    Locked = 'LOCKED',
    NoAccount = 'NO_ACCOUNT',
    NoPermission = 'NO_PERMISSION',
    InvalidRequest = 'INVALID_REQUEST',
    BadArgs = 'BAD_ARGS',
    AbiUnavailable = 'ABI_UNAVAILABLE',
    Unknown = 'UNKNOWN',
}

const TYPE_MAP: Record<string, MetahubErrorCode> = {
    signature_rejected: MetahubErrorCode.UserRejected,
    locked: MetahubErrorCode.Locked,
    no_account: MetahubErrorCode.NoAccount,
    no_permission: MetahubErrorCode.NoPermission,
    invalid_request: MetahubErrorCode.InvalidRequest,
    bad_args: MetahubErrorCode.BadArgs,
    abi_unavailable: MetahubErrorCode.AbiUnavailable,
}

export class MetahubError extends Error {
    public readonly code: MetahubErrorCode
    public readonly cause?: unknown

    constructor(code: MetahubErrorCode, message: string, cause?: unknown) {
        super(message)
        this.name = 'MetahubError'
        this.code = code
        this.cause = cause
        Object.setPrototypeOf(this, MetahubError.prototype)
    }

    static from(err: unknown): MetahubError {
        if (err instanceof MetahubError) return err
        if (err && typeof err === 'object') {
            const anyErr = err as any
            const type = anyErr.type as string | undefined
            const code = type && TYPE_MAP[type] ? TYPE_MAP[type] : MetahubErrorCode.Unknown
            const message =
                typeof anyErr.message === 'string' ? anyErr.message : String(err)
            return new MetahubError(code, message, err)
        }
        return new MetahubError(MetahubErrorCode.Unknown, String(err), err)
    }
}
