from datetime import datetime
from sqlalchemy.orm import Session

from app.models.event import Category
from app.core.exceptions import NotFoundError, ConflictError


def list_categories(db: Session) -> list[Category]:
    return db.query(Category).all()


def create_category(db: Session, name: str, description: str | None) -> Category:
    if db.query(Category).filter(Category.name == name).first():
        raise ConflictError("Category already exists")

    category = Category(name=name, description=description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> None:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise NotFoundError("Category not found")
    db.delete(category)
    db.commit()