export function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      error.status = 422;
      error.details = error.details.map((item) => item.message);
      return next(error);
    }
    req.body = value;
    next();
  };
}
