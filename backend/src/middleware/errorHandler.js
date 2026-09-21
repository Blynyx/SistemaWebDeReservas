export function notFoundHandler(req, res, next) {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(err, req, res, next) {
  if (err.statusCode && err.statusCode < 500) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  console.error(err);

  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    res.status(409).json({
      status: 'error',
      message: 'Ya existe un registro con esos datos',
    });
    return;
  }

  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
  });
}
