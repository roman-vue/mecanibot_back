export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, `${what} not found`, 'NOT_FOUND');

export const conflict = (message: string, code: string) => new AppError(409, message, code);
export const invalidCredentials = () => new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
export const proRequired = (message: string) => new AppError(403, message, 'PRO_REQUIRED');
