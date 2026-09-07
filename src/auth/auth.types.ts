export interface AuthUser { sub: string; email: string; permissions: string[]; tokenVersion: number }
// Express uses declaration merging for request extensions.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { namespace Express { interface Request { user?: AuthUser } } }
