from datetime import datetime
from sqlalchemy.orm import Session

from app.models.event import Category
from app.core.exceptions import NotFoundError, BadRequestError, ConflictError


def list_categories(db: Session) -> list[Category]:
    return db.query(Category).filter(Category.deleted_at.is_(None)).all()


def create_category(db: Session, name: str, description: str | None) -> Category:
    if db.query(Category).filter(Category.name == name, Category.deleted_at.is_(None)).first():
        raise ConflictError("Category already exists")

    category = Category(name=name, description=description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> None:
    category = db.query(Category).filter(Category.id == category_id, Category.deleted_at.is_(None)).first()
    if not category:
        raise NotFoundError("Category not found")
    category.deleted_at = datetime.now()
    db.commit()
