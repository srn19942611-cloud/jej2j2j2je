"""Small, dependency-free helpers for the two rate-limit concerns real connectors face:
spacing out calls to a slow-limit endpoint (FusionSolar's ~1 call/5min) and backing off
on transient failures (429/timeout) rather than hammering the vendor API."""

import logging
import time
from collections.abc import Callable
from typing import TypeVar

log = logging.getLogger(__name__)

T = TypeVar("T")


class MinIntervalGate:
    """Refuses to fire more often than `min_interval_seconds` per endpoint key.
    Used so a connector never exceeds its platform's documented rate limit even if the
    scheduler were misconfigured to poll more frequently."""

    def __init__(self, min_interval_seconds: float):
        self.min_interval_seconds = min_interval_seconds
        self._last_call: dict[str, float] = {}

    def ready(self, key: str) -> bool:
        last = self._last_call.get(key)
        return last is None or (time.monotonic() - last) >= self.min_interval_seconds

    def mark(self, key: str) -> None:
        self._last_call[key] = time.monotonic()


def with_backoff(
    func: Callable[[], T],
    max_retries: int = 3,
    base_delay_seconds: float = 2.0,
    retryable_exceptions: tuple[type[Exception], ...] = (Exception,),
) -> T:
    """Calls func(), retrying with exponential backoff on retryable_exceptions."""
    attempt = 0
    while True:
        try:
            return func()
        except retryable_exceptions as exc:
            attempt += 1
            if attempt > max_retries:
                raise
            delay = base_delay_seconds * (2 ** (attempt - 1))
            log.warning("Retryable error (%s/%s), backing off %.1fs: %s", attempt, max_retries, delay, exc)
            time.sleep(delay)
