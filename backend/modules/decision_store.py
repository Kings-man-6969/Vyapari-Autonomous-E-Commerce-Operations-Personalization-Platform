"""
Decision Store — SQLite-backed HITL audit log.
Every agent decision is stored with full context.
"""
import sqlite3, json, os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/decisions.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS decisions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                type        TEXT NOT NULL,
                product_id  TEXT,
                product_name TEXT,
                mode        TEXT,
                confidence  REAL,
                reasoning   TEXT,
                payload     TEXT,
                status      TEXT DEFAULT 'pending',
                created_at  TEXT,
                resolved_at TEXT,
                resolved_by TEXT
            )
        """)
        conn.commit()

def store_decisions(decisions: list[dict]) -> list[dict]:
    """Store a batch of agent decisions. Skip duplicates (same product+type+pending)."""
    init_db()
    stored = []
    with get_conn() as conn:
        for d in decisions:
            # Check for existing pending decision of same type+product
            exists = conn.execute(
                "SELECT id FROM decisions WHERE product_id=? AND type=? AND status='pending'",
                (d.get("product_id"), d.get("type"))
            ).fetchone()
            if exists:
                continue
            cur = conn.execute("""
                INSERT INTO decisions (type, product_id, product_name, mode, confidence, reasoning, payload, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (
                d.get("type"), d.get("product_id"), d.get("product_name"),
                d.get("mode"), d.get("confidence"), d.get("reasoning"),
                json.dumps(d), d.get("created_at", datetime.now().isoformat())
            ))
            d["db_id"] = cur.lastrowid
            stored.append(d)
        conn.commit()
    return stored

def get_pending_decisions() -> list[dict]:
    init_db()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM decisions WHERE status='pending' ORDER BY confidence DESC"
        ).fetchall()
    return [dict(r) for r in rows]

def get_all_decisions(limit: int = 50) -> list[dict]:
    init_db()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("payload"):
            d["payload"] = json.loads(d["payload"])
        result.append(d)
    return result

def resolve_decision(decision_id: int, action: str, resolved_by: str = "operator"):
    """action: 'approved' | 'rejected'"""
    init_db()
    with get_conn() as conn:
        conn.execute(
            "UPDATE decisions SET status=?, resolved_at=?, resolved_by=? WHERE id=?",
            (action, datetime.now().isoformat(), resolved_by, decision_id)
        )
        conn.commit()
