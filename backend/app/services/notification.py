from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.notification import Notification, NotificationPreferences
from app.models.user import User
from app.schemas.notification import NotificationPreferencesUpdateRequest

def get_my_notifications(db: Session, current_user: User):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        (Notification.expires_at > datetime.now()) | (Notification.expires_at.is_(None))
    ).order_by(Notification.created_at.desc()).all()
    return notifications

def mark_as_read(db: Session, notification_id: int, current_user: User):
    notification = db.query(Notification).filter(
        Notification.id ==notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now()
        db.commit()
    return notification

def mark_all_as_read(db: Session, current_user: User):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False)
    ).update({
        "is_read": True,
        "read_at": datetime.now()
    })
    db.commit()

def get_unread_count(db: Session, current_user: User):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False),
        (Notification.expires_at > datetime.now()) | (Notification.expires_at.is_(None))
    ).count()
    return count

def delete_notification(db: Session, notification_id: int, current_user: User):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    db.delete(notification)
    db.commit()


def get_preferences(db: Session, current_user: User):
    prefs = db.query(NotificationPreferences).filter(
        NotificationPreferences.user_id == current_user.id
    ).first()
    if not prefs:
        prefs = NotificationPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs    


def update_preferences(db: Session, data: NotificationPreferencesUpdateRequest, current_user: User):
    prefs = get_preferences(db, current_user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return prefs