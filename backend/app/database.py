from typing import Optional

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.config import settings
from app.core.logging import logger

_client: Optional[AsyncMongoClient] = None
_db: Optional[AsyncDatabase] = None
_is_connected: bool = False


async def init_database() -> bool:
    """Initialize MongoDB async client and create required collection indexes."""
    global _client, _db, _is_connected
    try:
        logger.info("Connecting to MongoDB at %s ...", settings.mongodb_uri)
        _client = AsyncMongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
            maxPoolSize=50,
            minPoolSize=5,
            maxIdleTimeMS=45000,
        )
        try:
            _db = _client.get_default_database(default=settings.mongodb_database)
        except Exception:
            _db = _client[settings.mongodb_database]

        # Verify connectivity by issuing a ping command
        await _client.admin.command("ping")
        _is_connected = True
        logger.info("MongoDB connection established successfully.")

        # Create indexes
        await _create_indexes(_db)
        return True
    except Exception as exc:
        _is_connected = False
        logger.warning(
            "MongoDB connection failed during initialization: %s. Application will run with database degraded.",
            str(exc),
        )
        return False


async def _create_indexes(db: AsyncDatabase) -> None:
    """Create essential performance and uniqueness indexes."""
    try:
        # Users collection
        await db["users"].create_index([("email", ASCENDING)], unique=True)
        await db["users"].create_index([("created_at", DESCENDING)])

        # Agents collection
        await db["agents"].create_index([("owner_id", ASCENDING), ("created_at", DESCENDING)])
        await db["agents"].create_index([("provider_agent_id", ASCENDING)], sparse=True)
        await db["agents"].create_index([("elevenlabs_agent_id", ASCENDING)], sparse=True)
        await db["agents"].create_index([("status", ASCENDING)])

        # Agent Versions collection
        await db["agent_versions"].create_index(
            [("agent_id", ASCENDING), ("version", ASCENDING)], unique=True
        )
        await db["agent_versions"].create_index(
            [("agent_id", ASCENDING), ("created_at", DESCENDING)]
        )

        # Sessions collection
        await db["sessions"].create_index([("agent_id", ASCENDING), ("started_at", DESCENDING)])
        await db["sessions"].create_index([("owner_id", ASCENDING), ("created_at", DESCENDING)])
        await db["sessions"].create_index([("owner_id", ASCENDING), ("started_at", DESCENDING)])
        await db["sessions"].create_index([("owner_id", ASCENDING), ("status", ASCENDING)])
        await db["sessions"].create_index([("provider_conversation_id", ASCENDING)], sparse=True)

        # Knowledge Sources collection
        await db["knowledge_sources"].create_index(
            [("agent_id", ASCENDING), ("owner_id", ASCENDING)]
        )
        await db["knowledge_sources"].create_index([("created_at", DESCENDING)])

        # Test Runs collection
        await db["test_runs"].create_index([("agent_id", ASCENDING), ("created_at", DESCENDING)])
        await db["test_runs"].create_index([("owner_id", ASCENDING)])

        logger.info("MongoDB collection indexes verified/created.")
    except PyMongoError as err:
        logger.error("Failed to create some MongoDB indexes: %s", str(err))


async def ping_database() -> bool:
    """Check whether MongoDB is responsive."""
    global _client, _is_connected
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
        _is_connected = True
        return True
    except Exception:
        _is_connected = False
        return False


def is_database_connected() -> bool:
    return _is_connected


def get_database() -> AsyncDatabase:
    """Return the active MongoDB database."""
    global _client, _db
    if _db is None:
        # If client not initialized yet, initialize lazily
        _client = AsyncMongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
            maxPoolSize=50,
            minPoolSize=5,
            maxIdleTimeMS=45000,
        )
        try:
            _db = _client.get_default_database(default=settings.mongodb_database)
        except Exception:
            _db = _client[settings.mongodb_database]
    return _db


def get_collection(collection_name: str) -> AsyncCollection:
    """Return an async collection handle from the current database."""
    return get_database()[collection_name]


async def close_database() -> None:
    """Close MongoDB client connection."""
    global _client, _db, _is_connected
    if _client is not None:
        await _client.close()
        _client = None
        _db = None
        _is_connected = False
        logger.info("MongoDB connection closed.")
