/*
 * Result Type Pattern for TypeScript
 *
 * This pattern is useful for "expected" failures (like validation errors).
 * It forces the consumer to check for success before accessing the value.
 */

// Result type for explicit error handling
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Constructors
export function Ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

// Chaining (functional approach)
export function chainResult<T, U, E>(
    result: Result<T, E>,
    transform: (val: T) => Result<U, E> // Returns a new Result
): Result<U, E> {
    if (!result.ok) {
        return Err(result.error);
    }
    return transform(result.value);
}

// Maps success value to new type, keeps error same
export function mapResult<T, U, E>(
    result: Result<T, E>,
    transform: (val: T) => U
): Result<U, E> {
    if (!result.ok) {
        return Err(result.error);
    }
    return Ok(transform(result.value));
}

// Usage Example
/*
function parseJson<T>(json: string): Result<T, SyntaxError> {
  try {
    return Ok(JSON.parse(json) as T);
  } catch (error) {
    return Err(error as SyntaxError);
  }
}
*/
