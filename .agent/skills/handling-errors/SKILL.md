---
name: handling-errors
description: Guide for building resilient applications with robust error handling strategies. Use this skill to implement error handling, debug production issues, and improve application reliability.
---

# Error Handling Patterns

## When to Use This Skill
- Implementing error handling in new features
- Designing error-resilient APIs
- Debugging production issues
- Improving application reliability
- Creating better error messages for users and developers
- Implementing retry and circuit breaker patterns
- Handling async/concurrent errors
- Building fault-tolerant distributed systems

## Workflow

1.  **Identify Failure Modes**: What can go wrong? (Network, input, resource limits)
2.  **Choose Strategy**:
    - **Recoverable**: Users can fix it (e.g. invalid input) -> *Result Type / Checked Exception*
    - **Unrecoverable**: System is broken (e.g. OOM) -> *Crash / 500 Error*
3.  **Implement Pattern**: Select from the patterns below (Result, Custom Error, Circuit Breaker).
4.  **Enrich Context**: Add metadata (IDs, timestamps) to errors.
5.  **Log & Monitor**: Ensure errors are visible in logs but don't spam.

## Core Concepts

### 1. Error Categories
- **Recoverable**: Network timeouts, missing files, invalid input. *Action: Retry or ask user.*
- **Unrecoverable**: Out of memory, programming bugs. *Action: Fail fast and safe.*

### 2. Philosophies
- **Exceptions**: For unexpected conditions.
- **Result Types**: For expected failures (validation, business logic).

## Language-Specific Patterns

### TypeScript / JavaScript

**Custom Error Hierarchy (`resources/typescript-errors.ts`)**
```typescript
class ApplicationError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500, public details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, "NOT_FOUND", 404, { resource, id });
  }
}
```

**Result Type Pattern (`resources/typescript-result.ts`)**
```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
function Ok<T>(value: T): Result<T> { return { ok: true, value }; }
function Err<E>(error: E): Result<never, E> { return { ok: false, error }; }
```

### Python

**Context Managers & Custom Exceptions**
See `resources/python-patterns.md` for `database_transaction` and custom exception hierarchies.

## Universal Patterns

### 1. Circuit Breaker
Prevents cascading failures. If a service fails repeatedly, stop calling it for a while.
*Implementation*: See `resources/circuit-breaker.py`

### 2. Error Aggregation
Collect multiple validation errors instead of failing on the first one.
*Implementation*: See `resources/error-aggregation.ts`

### 3. Graceful Degradation
If a primary service fails, return cached data or a default value.
```python
result = try_primary() or try_cache() or default_value
```

## Best Practices Checklist
- [ ] **Fail Fast**: Validate input early.
- [ ] **Preserve Context**: Wraps errors with "caused by" or metadata.
- [ ] **Clean Up**: Use `try-finally` or `using` blocks.
- [ ] **User vs Dev Messages**: Show "Something went wrong" to users, but full stack trace to devs.
- [ ] **No Silent Failures**: Never `catch (e) { /* ignore */ }`.

## Resources
- [TypeScript Error Patterns](resources/typescript-errors.ts)
- [Result Type Helper](resources/typescript-result.ts)
- [Circuit Breaker Logic](resources/circuit-breaker.py)
