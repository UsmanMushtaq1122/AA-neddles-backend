const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const data = source === "body" ? req.body : source === "query" ? req.query : source === "params" ? req.params : source === "headers" ? req.headers : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Please fill in all required fields.",
        errors: messages,
      });
    }
    if (source === "body") req.body = value;
    else if (source === "query") req.query = value;
    else if (source === "params") req.params = value;
    else if (source === "headers") req.headers = value;
    next();
  };
};

module.exports = validate;
