from enum import Enum
from datetime import datetime
from typing import Callable, TypeVar, Optional, Dict
import time
from functools import wraps

"""
1. Custom Exception Hierarchy
"""
class ApplicationError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class NotFoundError(ApplicationError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            f"{resource} not found",
            code="NOT_FOUND",
            details={"resource": resource, "id": resource_id}
        )

"""
2. Circuit Breaker (Resiliency Pattern)
"""
T = TypeVar('T')

class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout_seconds: float = 60.0,
        success_threshold: int = 2
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout_seconds
        self.success_threshold = success_threshold
        
        self.failure_count = 0
        self.success_count = 0
        self.state = CircuitState.CLOSED
        self.last_failure_time: Optional[datetime] = None

    def call(self, func: Callable[[], T]) -> T:
        if self.state == CircuitState.OPEN:
            now = datetime.now()
            if self.last_failure_time and (now - self.last_failure_time).total_seconds() > self.timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                raise Exception("Circuit breaker is OPEN - failing fast")

        try:
            result = func()
            self.on_success()
            return result
        except Exception:
            self.on_failure()
            raise

    def on_success(self):
        self.failure_count = 0
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                print("Circuit CLOSED (Recovered)")
                self.success_count = 0

    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        if self.failure_count >= self.failure_threshold:
            print("Circuit OPEN (Failures exceeded threshold)")
            self.state = CircuitState.OPEN
