class AppError extends Error {
  /**
   * @param {string} message  human-readable message, safe to show a client
   * @param {number} statusCode
   * @param {string[]} [details]  field-level validation messages
   * @param {string} [code]  stable machine-readable code the frontend can branch on,
   *                         e.g. TOKEN_EXPIRED or EMAIL_NOT_VERIFIED. Never localise
   *                         or reword these; clients depend on the exact value.
   */
  constructor(message, statusCode = 500, details = undefined, code = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = code;
    this.isOperational = true;
  }
}

module.exports = AppError;
