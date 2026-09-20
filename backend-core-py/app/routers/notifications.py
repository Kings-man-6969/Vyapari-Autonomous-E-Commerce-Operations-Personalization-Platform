import json
from fastapi import APIRouter, Depends
from app.auth.dependencies import require_auth
from app.db import get_db

router = APIRouter(tags=["notifications"])


@router.get("")
@router.get("/")
async def get_notifications(
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    rows = await db.fetch(
        """SELECT id, type, title, body, link, is_read, metadata, created_at
           FROM notifications
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 50""",
        user["id"],
    )

    unread_count = await db.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
        user["id"],
    )

    notifications = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if isinstance(d.get("metadata"), str):
            try:
                d["metadata"] = json.loads(d["metadata"])
            except Exception:
                pass
        notifications.append(d)

    return {
        "success": True,
        "data": {
            "notifications": notifications,
            "unread_count": int(unread_count or 0),
        },
    }


@router.put("/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    await db.execute(
        "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
        notif_id,
        user["id"],
    )
    return {"success": True, "message": "Notification marked as read."}


@router.put("/read-all")
async def mark_all_notifications_read(
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    await db.execute(
        "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
        user["id"],
    )
    return {"success": True, "message": "All notifications marked as read."}
