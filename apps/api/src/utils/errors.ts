export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export const Errors = {
  Unauthorized: () => new AppError(401, 'Unauthorized'),
  Forbidden: () => new AppError(403, 'Forbidden'),
  NotFound: (resource = 'Resource') => new AppError(404, `${resource} not found`),
  Conflict: (msg: string) => new AppError(409, msg),
  BadRequest: (msg: string) => new AppError(400, msg),
  InsufficientFunds: () => new AppError(400, 'Insufficient wallet balance'),
  InvalidTransition: (from: string, to: string) =>
    new AppError(400, `Cannot transition task from ${from} to ${to}`),
}
