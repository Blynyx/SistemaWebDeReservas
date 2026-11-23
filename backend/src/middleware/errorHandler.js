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

  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
  });
}
