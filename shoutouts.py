from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import exists, or_
from typing import List, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from .. import schemas
from ..models import (
    AdminNotification,
    User,
    ShoutOut,
    ShoutOutRecipient,
    Reaction,
    Comment,
    Attachment,
    Report,
    Notification,
)
from ..deps import get_current_user, get_db
from ..cloudinary_utils import upload_image_to_cloudinary


def _truncate(text: str, limit: int = 80) -> str:
    clean = (text or "").strip()
    if len(clean) <= limit:
        return clean
    return clean[: limit - 3].rstrip() + "..."


def _notify_admins(
    db: Session,
    *,
    actor: User,
    event_type: str,
    message: str,
    shoutout_id: int | None = None,
    report_id: int | None = None,
) -> None:
    note = AdminNotification(
        event_type=event_type,
        message=_truncate(message, 500),
        actor_id=actor.id,
        shoutout_id=shoutout_id,
        report_id=report_id,
    )
    db.add(note)


IST = ZoneInfo("Asia/Kolkata")


def _to_ist(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def _apply_ist_to_reactions(reactions: List[Reaction]) -> List[Reaction]:
    for reaction in reactions:
        reaction.created_at = _to_ist(reaction.created_at)
    return reactions


def _apply_ist_to_comments(comments: List[Comment]) -> List[Comment]:
    for comment in comments:
        comment.created_at = _to_ist(comment.created_at)
    return comments


def _apply_ist_to_attachments(attachments: List[Attachment]) -> List[Attachment]:
    for attachment in attachments:
        attachment.created_at = _to_ist(attachment.created_at)
    return attachments


router = APIRouter()

def _serialize_shoutout(shout: ShoutOut, db: Session):
    recipients_users = [db.get(User, r.user_id) for r in shout.recipients]
    shout.created_at = _to_ist(shout.created_at)
    reactions = _apply_ist_to_reactions(shout.reactions)
    comments = _apply_ist_to_comments(shout.comments)
    attachments = _apply_ist_to_attachments(shout.attachments if hasattr(shout, "attachments") else [])
    return schemas.ShoutOutOut(
        id=shout.id,
        content=shout.content,
        department_id=shout.department_id,
        created_at=shout.created_at,
        created_by=shout.created_by,
        recipients=recipients_users,
        reactions=reactions,
        comments=comments,
        attachments=attachments,
    )

@router.post("/", response_model=schemas.ShoutOutOut)
def create_shoutout(
    data: schemas.ShoutOutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validation is handled by Pydantic schema, but keeping for backward compatibility
    if not data.recipient_ids or len(data.recipient_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient is required."
        )
    shout = ShoutOut(
        content=data.content,
        department_id=data.department_id or current_user.department_id,
        created_by_id=current_user.id,
    )
    db.add(shout)
    db.flush()
    recipients = []
    notifications = []
    for rid in set(data.recipient_ids):
        recipients.append(ShoutOutRecipient(shoutout_id=shout.id, user_id=rid))
        # Create notification for each recipient (excluding the creator)
        if rid != current_user.id:
            notifications.append(Notification(shoutout_id=shout.id, user_id=rid))
    db.add_all(recipients)
    if notifications:
        db.add_all(notifications)
    db.commit()
    db.refresh(shout)
    # Eager load relationships for serialization
    shout = db.query(ShoutOut).options(
        selectinload(ShoutOut.created_by),
        selectinload(ShoutOut.recipients),
        selectinload(ShoutOut.reactions).selectinload(Reaction.user),
        selectinload(ShoutOut.comments).selectinload(Comment.user),
        selectinload(ShoutOut.attachments)
    ).filter(ShoutOut.id == shout.id).first()
    # Correct serialization: return User objects for recipients
    return _serialize_shoutout(shout, db)

@router.get("/", response_model=List[schemas.ShoutOutOut])
def list_shoutouts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    department: Optional[int] = Query(None),
    sender: Optional[int] = Query(None),
    recipient: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    has_attachments: Optional[bool] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
):
    q = db.query(ShoutOut).options(
        selectinload(ShoutOut.created_by),
        selectinload(ShoutOut.recipients),
        selectinload(ShoutOut.reactions).selectinload(Reaction.user),
        selectinload(ShoutOut.comments).selectinload(Comment.user),
        selectinload(ShoutOut.attachments)
    )
    if department:
        q = q.filter(ShoutOut.department_id == department)
    if sender:
        q = q.filter(ShoutOut.created_by_id == sender)
    if recipient:
        q = q.join(ShoutOutRecipient).filter(ShoutOutRecipient.user_id == recipient)
    if start_date:
        q = q.filter(ShoutOut.created_at >= start_date)
    if end_date:
        q = q.filter(ShoutOut.created_at <= end_date)
    if has_attachments is not None:
        attachment_exists = exists().where(Attachment.shoutout_id == ShoutOut.id)
        if has_attachments:
            q = q.filter(attachment_exists)
        else:
            q = q.filter(~attachment_exists)
    # Allow all users to see shoutouts from all departments
    # Department filtering is now handled by the department query parameter above
    # Removed department restriction so users can see and interact with posts from all departments
    shoutouts = q.order_by(ShoutOut.created_at.desc()).offset(offset).limit(limit).all()
    # Correct serialization for recipients
    return [_serialize_shoutout(so, db) for so in shoutouts]

@router.post("/{shoutout_id}/react", response_model=schemas.ReactionOut)
def react_to_shoutout(
    shoutout_id: int,
    data: schemas.ReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shout = db.get(ShoutOut, shoutout_id)
    if not shout:
        raise HTTPException(status_code=404, detail="ShoutOut not found")
    existing = (
        db.query(Reaction)
        .filter_by(shoutout_id=shoutout_id, user_id=current_user.id)
        .first()
    )
    if existing:
        if existing.type == data.type:
            db.delete(existing)
            db.commit()
            raise HTTPException(
                status_code=200, detail="Reaction removed."
            )
        existing.type = data.type
        db.commit()
        db.refresh(existing)
        reaction = (
            db.query(Reaction)
            .options(selectinload(Reaction.user))
            .filter(Reaction.id == existing.id)
            .first()
        )
        reaction.created_at = _to_ist(reaction.created_at)
        return reaction
    reaction = Reaction(
        shoutout_id=shoutout_id,
        user_id=current_user.id,
        type=data.type,
    )
    db.add(reaction)
    db.commit()
    db.refresh(reaction)
    
    # Create notification for the shoutout creator if they're not the one reacting
    if shout.created_by_id != current_user.id:
        # Check if notification already exists for this reaction
        existing_notif = db.query(Notification).filter_by(
            user_id=shout.created_by_id,
            shoutout_id=shoutout_id
        ).first()
        if not existing_notif:
            notification = Notification(
                user_id=shout.created_by_id,
                shoutout_id=shoutout_id,
            )
            db.add(notification)
            db.commit()
    
    # Reload reaction with user relationship for proper serialization
    reaction = db.query(Reaction).options(selectinload(Reaction.user)).filter(Reaction.id == reaction.id).first()
    reaction.created_at = _to_ist(reaction.created_at)
    return reaction

@router.get("/{shoutout_id}/comments", response_model=List[schemas.CommentOut])
def get_shoutout_comments(
    shoutout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all comments for a specific shoutout"""
    shout = db.get(ShoutOut, shoutout_id)
    if not shout:
        raise HTTPException(status_code=404, detail="ShoutOut not found")
    
    comments = db.query(Comment).options(
        selectinload(Comment.user)
    ).filter(Comment.shoutout_id == shoutout_id).order_by(Comment.created_at.asc()).all()
    
    return _apply_ist_to_comments(comments)


@router.post("/{shoutout_id}/comment", response_model=schemas.CommentOut)
def comment_on_shoutout(
    shoutout_id: int,
    data: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a comment to a shoutout"""
    shout = db.get(ShoutOut, shoutout_id)
    if not shout:
        raise HTTPException(status_code=404, detail="ShoutOut not found")
    
    # Validation is handled by Pydantic schema
    if not data.content or not data.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment content cannot be empty."
        )
    # Validate parent comment if provided
    parent_id = data.parent_id
    if parent_id is not None:
        parent = db.get(Comment, parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.shoutout_id != shoutout_id:
            raise HTTPException(status_code=400, detail="Parent comment mismatch for shoutout")
    
    comment = Comment(
        shoutout_id=shoutout_id,
        user_id=current_user.id,
        content=data.content.strip(),
        parent_id=parent_id,
    )
    db.add(comment)
    db.commit()
    
    # Create notification for the shoutout creator if they're not the one commenting
    if shout.created_by_id != current_user.id:
        # Check if notification already exists for this shoutout
        existing_notif = db.query(Notification).filter_by(
            user_id=shout.created_by_id,
            shoutout_id=shoutout_id
        ).first()
        if not existing_notif:
            notification = Notification(
                user_id=shout.created_by_id,
                shoutout_id=shoutout_id,
            )
            db.add(notification)
            db.commit()
    db.refresh(comment)
    # Reload comment with user relationship for proper serialization
    comment = db.query(Comment).options(selectinload(Comment.user)).filter(Comment.id == comment.id).first()
    comment.created_at = _to_ist(comment.created_at)
    return comment


@router.delete("/{shoutout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shoutout(
    shoutout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    shout = db.get(ShoutOut, shoutout_id)
    if not shout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ShoutOut not found")
    if not current_user.is_admin and shout.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this shout-out")
    user_deleted = not current_user.is_admin and shout.created_by_id == current_user.id
    if user_deleted:
        snippet = _truncate(shout.content or "", 80)
        _notify_admins(
            db,
            actor=current_user,
            event_type="shoutout_deleted",
            message=f"{current_user.full_name} deleted their shout-out (#{shout.id}): \"{snippet}\"",
        )
    # Manually delete related rows to avoid FK violations
    report_ids = [
        rid for (rid,) in db.query(Report.id).filter(Report.shoutout_id == shoutout_id).all()
    ]
    if report_ids:
        db.query(AdminNotification).filter(
            or_(
                AdminNotification.shoutout_id == shoutout_id,
                AdminNotification.report_id.in_(report_ids),
            )
        ).delete(synchronize_session=False)
    else:
        db.query(AdminNotification).filter(
            AdminNotification.shoutout_id == shoutout_id
        ).delete(synchronize_session=False)
    db.query(Report).filter(Report.shoutout_id == shoutout_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.shoutout_id == shoutout_id).delete(synchronize_session=False)
    db.query(Comment).filter(Comment.shoutout_id == shoutout_id).delete(synchronize_session=False)
    db.query(Reaction).filter(Reaction.shoutout_id == shoutout_id).delete(synchronize_session=False)
    db.query(Attachment).filter(Attachment.shoutout_id == shoutout_id).delete(synchronize_session=False)
    db.query(ShoutOutRecipient).filter(ShoutOutRecipient.shoutout_id == shoutout_id).delete(synchronize_session=False)
    db.delete(shout)
    db.commit()


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    comment = (
        db.query(Comment)
        .options(selectinload(Comment.user))
        .filter(Comment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if not current_user.is_admin and comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this comment")
    user_deleted = not current_user.is_admin and comment.user_id == current_user.id
    if user_deleted:
        snippet = _truncate(comment.content or "", 80)
        _notify_admins(
            db,
            actor=current_user,
            event_type="comment_deleted",
            message=f"{current_user.full_name} deleted a comment on shout-out #{comment.shoutout_id}: \"{snippet}\"",
            shoutout_id=comment.shoutout_id,
        )
    db.delete(comment)
    db.commit()


@router.post("/{shoutout_id}/upload-image", response_model=schemas.AttachmentOut)
async def upload_shoutout_image(
    shoutout_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an image attachment to a shoutout"""
    shout = db.get(ShoutOut, shoutout_id)
    if not shout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ShoutOut not found"
        )
    
    # Upload to Cloudinary
    upload_result = await upload_image_to_cloudinary(file, folder="shoutouts")
    
    # Create attachment record
    attachment = Attachment(
        shoutout_id=shoutout_id,
        file_url=upload_result["url"],
        file_name=file.filename or "image",
        file_type=file.content_type or "image/jpeg",
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    attachment.created_at = _to_ist(attachment.created_at)
    return attachment


@router.post("/{shoutout_id}/report", response_model=schemas.ReportOut, status_code=status.HTTP_201_CREATED)
def report_shoutout(
    shoutout_id: int,
    data: schemas.ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> schemas.ReportOut:
    shout = (
        db.query(ShoutOut)
        .options(selectinload(ShoutOut.created_by))
        .filter(ShoutOut.id == shoutout_id)
        .first()
    )
    if not shout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ShoutOut not found")
    if shout.created_by_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot report your own shout-out")
    existing = (
        db.query(Report)
        .filter(
            Report.shoutout_id == shoutout_id,
            Report.reporter_id == current_user.id,
            Report.status == "open",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already reported this shout-out")
    # Validation is handled by Pydantic schema
    reason = data.reason.strip() if data.reason and data.reason.strip() else None
    report = Report(
        shoutout_id=shoutout_id,
        reporter_id=current_user.id,
        reason=reason,
        status="open",
    )
    db.add(report)
    db.flush()
    reason_note = f" Reason: {reason}" if reason else ""
    _notify_admins(
        db,
        actor=current_user,
        event_type="report_submitted",
        message=f"{current_user.full_name} reported shout-out #{shoutout_id}.{reason_note}",
        shoutout_id=shoutout_id,
        report_id=report.id,
    )
    db.commit()
    report = (
        db.query(Report)
        .options(
            selectinload(Report.shoutout).selectinload(ShoutOut.created_by),
            selectinload(Report.reporter),
            selectinload(Report.resolved_by),
        )
        .filter(Report.id == report.id)
        .first()
    )
    return report
