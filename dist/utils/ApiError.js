class ApiError extends Error {
    statusCode;
    success = false;
    data = null;
    errors;
    constructor(statusCode, message = "Something went wrong", errors = [], stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        // Maintain the correct prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
        // Preserve custom stack trace if provided
        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
export { ApiError };
