from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..deps import get_current_user, require_admin
from ..models import Department, User


router = APIRouter()


@router.get("/public", response_model=list[schemas.DepartmentOut])
def list_departments_public(db: Session = Depends(get_db)):
    return db.query(Department).all()


@router.get("/", response_model=list[schemas.DepartmentOut])
def list_departments_scoped(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_admin:
        return db.query(Department).all()
    if current_user.department_id is None:
        return []
    dep = db.get(Department, current_user.department_id)
    return [dep] if dep else []


@router.post("/", response_model=schemas.DepartmentOut)
def create_department(data: schemas.DepartmentCreate, _: None = Depends(require_admin), db: Session = Depends(get_db)):
    exists = db.query(Department).filter(Department.name == data.name).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department already exists")
    dep = Department(name=data.name)
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


