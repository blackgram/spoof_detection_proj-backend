"""Database package."""

from app.db.firestore_client import get_firestore_client, FirestoreClient

__all__ = ["get_firestore_client", "FirestoreClient"]
