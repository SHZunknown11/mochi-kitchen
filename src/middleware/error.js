const { UpstreamError } = require('../utils/http');

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

const notFound = (req, res) => {
  res.status(404).json({ error: { message: 'That page does not exist.' } });
};

const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err instanceof UpstreamError) {
    return res.status(502).json({ error: { message: 'A recipe service is not answering right now. Please try again.' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'The request body is not valid JSON.' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'The request is too large.' } });
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.' } });
};

module.exports = { AppError, notFound, errorHandler };
