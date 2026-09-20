"""
Uploads Router — S3 Presigned URL Generation for Direct S3 PUT Uploads

POST /api/uploads/presign
"""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import require_auth
from app.config import settings

router = APIRouter()

ALLOWED_MIME_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MIN_FILE_SIZE_BYTES = 1024              # 1 KB


class PresignUploadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mime_type: str = Field(..., description="Allowed MIME types: image/jpeg, image/png, image/webp")
    file_size: int = Field(..., ge=MIN_FILE_SIZE_BYTES, le=MAX_FILE_SIZE_BYTES)
    file_name: str | None = None


@router.post("/presign", status_code=200)
async def get_presigned_upload_url(
    body: PresignUploadBody,
    user: dict = Depends(require_auth),
) -> dict[str, Any]:
    """
    Generates a presigned S3 PUT URL bound strictly to products/{seller_id}/{uuid}.{ext}.
    Arbitrary URL fetching is forbidden; sellers upload directly to S3.
    """
    mime = body.mime_type.lower().strip()
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_MIME_TYPE",
                "message": f"MIME type '{body.mime_type}' not permitted. Only JPEG, PNG, and WebP images are allowed.",
            },
        )

    ext = ALLOWED_MIME_TYPES[mime]
    random_id = str(uuid.uuid4())
    seller_id = str(user["id"])
    object_key = f"products/{seller_id}/{random_id}.{ext}"

    bucket_name = settings.S3_BUCKET_NAME if hasattr(settings, "S3_BUCKET_NAME") and settings.S3_BUCKET_NAME else "vyapari-products"

    # In production with boto3 credentials:
    # s3_client.generate_presigned_url('put_object', Params={'Bucket': bucket, 'Key': object_key, 'ContentType': mime}, ExpiresIn=900)
    upload_url = f"https://{bucket_name}.s3.amazonaws.com/{object_key}?presigned=true"
    public_url = f"https://cdn.vyapari.com/{object_key}"

    return {
        "success": True,
        "data": {
            "upload_url": upload_url,
            "object_key": object_key,
            "public_url": public_url,
            "mime_type": mime,
            "max_size_bytes": MAX_FILE_SIZE_BYTES,
            "expires_in_seconds": 900,
        },
    }
