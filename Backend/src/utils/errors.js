class HttpError extends Error {
  constructor(status, code, message, details) { super(message); Object.assign(this, { status, code, details }); }
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if(error.code===11000&&error.keyPattern?.username)error=new HttpError(409,'USERNAME_TAKEN','Ese nombre de usuario ya está en uso. Elige otro.');
  if (error.code === 11000 || error.name === 'VersionError') error = new HttpError(409, 'CONFLICT', 'Registro duplicado o modificado; vuelve a consultarlo');
  if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)) error = new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos');
  if (error.type === 'entity.parse.failed') error = new HttpError(400, 'INVALID_JSON', 'JSON inválido');
  if (error.type === 'entity.too.large') error = new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande');
  const status = error.status || 500;
  if (status >= 500) console.error(error.code || error.name);
  res.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message: status === 500 ? 'Error interno del servidor' : error.message,
    ...(error.details ? { details: error.details } : {}) } });
}
module.exports = { HttpError, errorHandler };
