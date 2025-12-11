from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import create_access_token, create_refresh_token, hash_password, verify_password, decode_token
from ..config import settings
from ..database import get_db
from ..models import User, Department


router = APIRouter()


@router.post("/register", response_model=schemas.UserOut)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == data.email).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    department_id = data.department_id
    if department_id is not None:
        dep_exists = db.get(Department, department_id)
        if not dep_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")

    is_first_user = db.query(User).count() == 0
    is_admin = False

    if is_first_user:
        is_admin = True
    elif data.admin_code:
        expected_code = settings.admin_invite_code
        if not expected_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin registration is disabled. Contact an existing admin.",
            )
        if data.admin_code.strip() != expected_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid admin invite code.",
            )
        is_admin = True

    user = User(
        email=data.email.strip().lower(),
        full_name=data.full_name.strip(),
        department_id=department_id,
        password_hash=hash_password(data.password),
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.TokenPair)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return schemas.TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=schemas.TokenPair)
def refresh(data: schemas.TokenRefreshRequest):
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = payload.get("sub")
    return schemas.TokenPair(
        access_token=create_access_token(str(user_id)),
        refresh_token=create_refresh_token(str(user_id)),
    )


