from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.event import CategoryResponse
from app.services.categories import list_categories, create_category

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return list_categories(db)


@router.post("", response_model=CategoryResponse, status_code=201)
def add_category(
    name: str,
    description: str = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return create_category(db, name, description)
