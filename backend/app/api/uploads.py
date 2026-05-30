import os
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException

from app.core.config import settings
from app.core.dependencies import require_organizer
from app.models.user import User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@router.post("/event-cover")
async def upload_event_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(require_organizer),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed.")

    contents = await file.read()
    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Image must be under {settings.MAX_IMAGE_SIZE_MB} MB.")

    ext = EXT_MAP[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}"}
