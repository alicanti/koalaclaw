#!/usr/bin/env python3
"""
Vector store for KoalaClaw — Qdrant + FastEmbed.

Each agent gets two collections:
  - agent_{id}_chat  — chat history (semantic search over conversations)
  - agent_{id}_docs  — uploaded documents (RAG)

Qdrant runs on the Docker network at 172.30.0.200:6333.
Falls back to localhost:6333 for development.
"""

import hashlib
import json
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

QDRANT_HOST = os.environ.get("QDRANT_HOST", "172.30.0.200")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
VECTOR_SIZE = 384

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False

_client: Optional[Any] = None
_embedder: Optional[Any] = None


def _get_client() -> Optional[Any]:
    global _client
    if not QDRANT_AVAILABLE:
        return None
    if _client is None:
        try:
            _client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=5)
            _client.get_collections()
        except Exception as e:
            print(f"[VECTOR] Qdrant connection failed ({QDRANT_HOST}:{QDRANT_PORT}): {e}", file=sys.stderr, flush=True)
            try:
                _client = QdrantClient(host="localhost", port=QDRANT_PORT, timeout=5)
                _client.get_collections()
                print("[VECTOR] Connected to Qdrant on localhost", file=sys.stderr, flush=True)
            except Exception:
                _client = None
    return _client


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from fastembed import TextEmbedding
            _embedder = TextEmbedding(model_name=EMBEDDING_MODEL)
            print(f"[VECTOR] FastEmbed model loaded: {EMBEDDING_MODEL}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"[VECTOR] FastEmbed init failed: {e}", file=sys.stderr, flush=True)
            _embedder = None
    return _embedder


def _embed(texts: List[str]) -> List[List[float]]:
    embedder = _get_embedder()
    if not embedder:
        return []
    try:
        return [list(v) for v in embedder.embed(texts)]
    except Exception as e:
        print(f"[VECTOR] Embedding failed: {e}", file=sys.stderr, flush=True)
        return []


def _chat_collection(agent_id: int) -> str:
    return f"agent_{agent_id}_chat"


def _docs_collection(agent_id: int) -> str:
    return f"agent_{agent_id}_docs"


def _ensure_collection(client, name: str):
    try:
        client.get_collection(name)
    except Exception:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print(f"[VECTOR] Created collection: {name}", file=sys.stderr, flush=True)


def is_available() -> bool:
    return _get_client() is not None


def init_agent(agent_id: int):
    client = _get_client()
    if not client:
        return
    _ensure_collection(client, _chat_collection(agent_id))
    _ensure_collection(client, _docs_collection(agent_id))
    print(f"[VECTOR] Initialized collections for agent {agent_id}", file=sys.stderr, flush=True)


def delete_agent(agent_id: int):
    client = _get_client()
    if not client:
        return
    for name in [_chat_collection(agent_id), _docs_collection(agent_id)]:
        try:
            client.delete_collection(name)
            print(f"[VECTOR] Deleted collection: {name}", file=sys.stderr, flush=True)
        except Exception:
            pass


# ── Chat History ──────────────────────────────────────────

def add_chat_message(agent_id: int, role: str, content: str, timestamp: str = ""):
    client = _get_client()
    if not client or not content.strip():
        return
    _ensure_collection(client, _chat_collection(agent_id))
    vectors = _embed([content])
    if not vectors:
        return
    point_id = str(uuid.uuid4())
    ts = timestamp or time.strftime("%Y-%m-%dT%H:%M:%S")
    try:
        client.upsert(
            collection_name=_chat_collection(agent_id),
            points=[PointStruct(
                id=point_id,
                vector=vectors[0],
                payload={"role": role, "content": content, "timestamp": ts, "agent_id": agent_id},
            )],
        )
    except Exception as e:
        print(f"[VECTOR] add_chat_message error: {e}", file=sys.stderr, flush=True)


def search_chat(agent_id: int, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    client = _get_client()
    if not client:
        return []
    vectors = _embed([query])
    if not vectors:
        return []
    try:
        results = client.query_points(
            collection_name=_chat_collection(agent_id),
            query=vectors[0],
            limit=limit,
        )
        return [
            {
                "role": r.payload.get("role", ""),
                "content": r.payload.get("content", ""),
                "timestamp": r.payload.get("timestamp", ""),
                "score": round(r.score, 3),
            }
            for r in results.points
        ]
    except Exception as e:
        print(f"[VECTOR] search_chat error: {e}", file=sys.stderr, flush=True)
        return []


# ── Documents (RAG) ──────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap
    return chunks


def add_document(agent_id: int, filename: str, content: str) -> int:
    client = _get_client()
    if not client or not content.strip():
        return 0
    _ensure_collection(client, _docs_collection(agent_id))
    chunks = chunk_text(content)
    if not chunks:
        return 0
    vectors = _embed(chunks)
    if not vectors or len(vectors) != len(chunks):
        return 0
    points = []
    for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={
                "filename": filename,
                "chunk_index": i,
                "content": chunk,
                "agent_id": agent_id,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        ))
    try:
        client.upsert(collection_name=_docs_collection(agent_id), points=points)
        print(f"[VECTOR] Added {len(points)} chunks from '{filename}' for agent {agent_id}", file=sys.stderr, flush=True)
        return len(points)
    except Exception as e:
        print(f"[VECTOR] add_document error: {e}", file=sys.stderr, flush=True)
        return 0


def search_docs(agent_id: int, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    client = _get_client()
    if not client:
        return []
    vectors = _embed([query])
    if not vectors:
        return []
    try:
        results = client.query_points(
            collection_name=_docs_collection(agent_id),
            query=vectors[0],
            limit=limit,
        )
        return [
            {
                "filename": r.payload.get("filename", ""),
                "content": r.payload.get("content", ""),
                "chunk_index": r.payload.get("chunk_index", 0),
                "score": round(r.score, 3),
            }
            for r in results.points
        ]
    except Exception as e:
        print(f"[VECTOR] search_docs error: {e}", file=sys.stderr, flush=True)
        return []


def delete_document(agent_id: int, filename: str) -> bool:
    client = _get_client()
    if not client:
        return False
    try:
        client.delete(
            collection_name=_docs_collection(agent_id),
            points_selector=Filter(
                must=[FieldCondition(key="filename", match=MatchValue(value=filename))]
            ),
        )
        print(f"[VECTOR] Deleted document '{filename}' for agent {agent_id}", file=sys.stderr, flush=True)
        return True
    except Exception as e:
        print(f"[VECTOR] delete_document error: {e}", file=sys.stderr, flush=True)
        return False
