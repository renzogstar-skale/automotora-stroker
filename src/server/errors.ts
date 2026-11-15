export class AppError extends Error {
  constructor(message: string, public status = 400, public code = "invalid") { super(message); }
}
export const conflict = (m: string) => new AppError(m, 409, "conflict");
export const notFound = (m = "Registro no encontrado.") => new AppError(m, 404, "not_found");
