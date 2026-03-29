/*
 * Error Handling Patterns for TypeScript
 *
 * This file contains patterns for managing errors robustly in TypeScript applications.
 */

/* 1. Custom Error Hierarchy */
export class ApplicationError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        // Maintains proper stack trace for where our error was thrown
        this.stack = new Error().stack;
    }
}

export class ValidationError extends ApplicationError {
    constructor(message: string, details?: Record<string, any>) {
        super(message, "VALIDATION_ERROR", 400, details);
    }
}

export class NotFoundError extends ApplicationError {
    constructor(resource: string, id: string | number) {
        super(`${resource} not found`, "NOT_FOUND", 404, { resource, id });
    }
}

/* 2. Error Aggregation (for multiple validations) */
export class ErrorCollector {
    private errors: Error[] = [];

    add(error: Error): void {
        this.errors.push(error);
    }

    hasErrors(): boolean {
        return this.errors.length > 0;
    }

    getErrors(): Error[] {
        return [...this.errors];
    }

    throwIfAny(): void {
        if (this.errors.length === 1) {
            throw this.errors[0];
        }
        if (this.errors.length > 1) {
            throw new AggregateError(
                this.errors,
                `${this.errors.length} errors occurred`
            );
        }
    }
}
