const { AppError } = require('./error');

/**
 * Validate req[source] against a Joi schema. The cleaned value is placed on req.valid[source]
 * (Express 5 makes req.query read-only, so we never write back to it).
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, "'") }));
    return next(new AppError(400, details[0].message, details));
  }
  req.valid = { ...req.valid, [source]: value };
  return next();
};

module.exports = { validate };
