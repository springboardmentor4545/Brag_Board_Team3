from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import hash_password, verify_password
from ..config import settings
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import User, Department
from ..cloudinary_utils import upload_image_to_cloudinary


router = APIRouter()

ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _is_local_avatar(url: str | None) -> bool:
    return bool(url and url.startswith("/media/avatars/"))


def _delete_avatar_file(url: str | None) -> None:
    if not _is_local_avatar(url):
        return
    relative_path = url[len("/media/") :]
    target = settings.media_root / relative_path
    try:
        target.relative_to(settings.media_root)
    except ValueError:
        return
    if target.is_file():
        target.unlink()


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=list[schemas.UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).all()


@router.get("/lookup", response_model=list[schemas.UserOut])
def lookup_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_admin:
        return db.query(User).all()
    elif current_user.department_id is not None:
        return db.query(User).filter(User.department_id == current_user.department_id).all()
    else:
        return [current_user]


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    data: schemas.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = data.model_dump(exclude_unset=True)
    updated = False

    if "full_name" in payload:
        full_name = (payload["full_name"] or "").strip()
        if not full_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name cannot be empty.")
        current_user.full_name = full_name
        updated = True

    if "department_id" in payload:
        department_id = payload["department_id"]
        if department_id is not None:
            department = db.get(Department, department_id)
            if not department:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")
        current_user.department_id = department_id
        updated = True

    if "avatar_url" in payload:
        avatar_url = (payload["avatar_url"] or "").strip()
        new_value = avatar_url or None
        if new_value != current_user.avatar_url:
            _delete_avatar_file(current_user.avatar_url)
        current_user.avatar_url = new_value
        updated = True

    if not updated:
        return current_user

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/change-password")
def change_password(
    data: schemas.PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different.")

    current_user.password_hash = hash_password(data.new_password)
    db.add(current_user)
    db.commit()
    return {"detail": "Password updated."}


@router.post("/me/avatar", response_model=schemas.UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, GIF, or WebP images are allowed.",
        )
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(contents) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar must be 5MB or smaller.")

    await file.seek(0)
    try:
        upload_result = await upload_image_to_cloudinary(file, folder="avatars")
    finally:
        await file.close()

    avatar_url = upload_result.get("url") or upload_result.get("secure_url")
    if not avatar_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar. Please try again.",
        )

    _delete_avatar_file(current_user.avatar_url)
    current_user.avatar_url = avatar_url

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


