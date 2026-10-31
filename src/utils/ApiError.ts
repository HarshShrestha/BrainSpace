
class ApiError extends Error {
    public readonly statusCode: number;
    public readonly success = false;
    public readonly data = null;
    public readonly errors: unknown[];

    constructor(
        statusCode: number,
        message = "Something went wrong",
        errors: unknown[] = [],
        stack = ""
    ) {
        super(message);

        this.statusCode = statusCode;
        this.errors = errors;

        // Maintain the correct prototype chain
        Object.setPrototypeOf(this, new.target.prototype);

        // Preserve custom stack trace if provided
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };
