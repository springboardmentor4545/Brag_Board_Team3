from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List

from .. import schemas
from ..models import Notification, ShoutOut, User, ShoutOutRecipient, Reaction, Comment, Attachment
from ..deps import get_current_user, get_db

router = APIRouter()


def _serialize_shoutout(shout: ShoutOut, db: Session):
    recipients_users = [db.get(User, r.user_id) for r in shout.recipients]
    return schemas.ShoutOutOut(
        id=shout.id,
        content=shout.content,
        department_id=shout.department_id,
        created_at=shout.created_at,
        created_by=shout.created_by,
        recipients=recipients_users,
        reactions=shout.reactions,
        comments=shout.comments,
        attachments=shout.attachments if hasattr(shout, 'attachments') else [],
    )


@router.get("/", response_model=List[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
):
    """Get all notifications for the current user"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.options(
        selectinload(Notification.shoutout).selectinload(ShoutOut.created_by),
        selectinload(Notification.shoutout).selectinload(ShoutOut.recipients),
        selectinload(Notification.shoutout).selectinload(ShoutOut.reactions).selectinload(Reaction.user),
        selectinload(Notification.shoutout).selectinload(ShoutOut.comments).selectinload(Comment.user),
        selectinload(Notification.shoutout).selectinload(ShoutOut.attachments),
    ).order_by(Notification.created_at.desc()).all()
    
    # Serialize notifications properly
    result = []
    for notif in notifications:
        shoutout_data = _serialize_shoutout(notif.shoutout, db)
        result.append(schemas.NotificationOut(
            id=notif.id,
            user_id=notif.user_id,
            shoutout=shoutout_data,
            is_read=notif.is_read,
            created_at=notif.created_at,
        ))
    
    return result


@router.get("/count", response_model=schemas.NotificationCount)
def get_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get count of unread notifications for the current user"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    return schemas.NotificationCount(unread_count=count)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read"""
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this notification")
    notification.is_read = True
    db.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for the current user"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()

