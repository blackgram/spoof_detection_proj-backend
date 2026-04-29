"""
In-memory liveness-session store for the multi-capture flow.

A session binds a customer to a randomised prompt challenge with a short TTL.
The mobile app must submit frames before the session expires, and the prompts
returned on /liveness/verify must match the server record — this prevents
replay of pre-recorded videos (attackers cannot predict the prompt order).

Production note: replace the module-level dict with a shared store (Redis /
Firestore with TTL) when running more than one backend instance. The interface
below is deliberately small so the swap is local.
"""

from __future__ import annotations

import logging
import random
import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Prompt pool. First prompt is ALWAYS "look_straight" so we have a reliable
# frontal frame for DeepFace face matching; the remaining prompts are randomly
# sampled to defeat replay of pre-recorded video.
LOOK_STRAIGHT = "look_straight"
_SECONDARY_PROMPTS = [
    "turn_left",
    "turn_right",
    "smile",
    "blink",
    "nod",
]

DEFAULT_PROMPT_COUNT = 3
DEFAULT_SESSION_TTL_SECONDS = 120    # 2 min to complete the challenge
DEFAULT_MAX_RETRIES = 2


@dataclass
class LivenessSession:
    session_id: str
    customer_id: str
    prompts: List[str]
    created_at: datetime
    expires_at: datetime
    retries_used: int = 0
    consumed: bool = False
    # Optional metadata dropped in by /verify (for auditing)
    meta: Dict[str, str] = field(default_factory=dict)


class LivenessSessionStore:
    """Thread-safe in-memory store with lazy TTL cleanup."""

    def __init__(self, ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS):
        self._sessions: Dict[str, LivenessSession] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def _cleanup_expired(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [sid for sid, s in self._sessions.items() if s.expires_at < now]
        for sid in expired:
            self._sessions.pop(sid, None)

    def create(
        self,
        customer_id: str,
        prompt_count: int = DEFAULT_PROMPT_COUNT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> LivenessSession:
        if prompt_count < 2:
            prompt_count = 2

        # Build prompts: always start with look_straight, then sample secondaries
        remaining = prompt_count - 1
        secondaries = random.sample(
            _SECONDARY_PROMPTS, k=min(remaining, len(_SECONDARY_PROMPTS))
        )
        prompts = [LOOK_STRAIGHT, *secondaries]

        now = datetime.now(timezone.utc)
        session = LivenessSession(
            session_id=f"lvs_{secrets.token_urlsafe(16)}",
            customer_id=customer_id,
            prompts=prompts,
            created_at=now,
            expires_at=now + timedelta(seconds=self._ttl),
            retries_used=0,
        )

        with self._lock:
            self._cleanup_expired()
            self._sessions[session.session_id] = session

        logger.info(
            "Created liveness session %s for customer=%s prompts=%s ttl=%ds",
            session.session_id, customer_id, prompts, self._ttl,
        )
        return session

    def get(self, session_id: str) -> Optional[LivenessSession]:
        with self._lock:
            self._cleanup_expired()
            return self._sessions.get(session_id)

    def mark_consumed(self, session_id: str) -> None:
        with self._lock:
            s = self._sessions.get(session_id)
            if s:
                s.consumed = True

    def bump_retry(self, session_id: str) -> int:
        """Increment retry counter; returns new retry count (or -1 if missing)."""
        with self._lock:
            s = self._sessions.get(session_id)
            if not s:
                return -1
            s.retries_used += 1
            return s.retries_used

    def invalidate(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)


# Singleton used by the router.
_store: Optional[LivenessSessionStore] = None


def get_store() -> LivenessSessionStore:
    global _store
    if _store is None:
        _store = LivenessSessionStore()
    return _store
