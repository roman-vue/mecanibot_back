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

export const proRequired = (message: string) => new AppError(403, message, 'PRO_REQUIRED');
