from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from .database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    department: Mapped[Department | None] = relationship("Department", back_populates="users")


class ShoutOut(Base):
    __tablename__ = "shoutouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    content: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)

    created_by: Mapped["User"] = relationship("User", backref="shoutouts_sent")
    department: Mapped[Department | None] = relationship("Department")
    recipients: Mapped[list["ShoutOutRecipient"]] = relationship(
        "ShoutOutRecipient",
        back_populates="shoutout",
        cascade="all, delete-orphan",
    )
    reactions: Mapped[list["Reaction"]] = relationship(
        "Reaction",
        back_populates="shoutout",
        cascade="all, delete-orphan",
    )
    comments: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="shoutout",
        cascade="all, delete-orphan",
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment",
        back_populates="shoutout",
        cascade="all, delete-orphan",
    )
    reports: Mapped[list["Report"]] = relationship(
        "Report",
        back_populates="shoutout",
        cascade="all, delete-orphan",
    )


class ShoutOutRecipient(Base):
    __tablename__ = "shoutout_recipients"
    shoutout_id: Mapped[int] = mapped_column(ForeignKey("shoutouts.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    user: Mapped["User"] = relationship("User")
    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut", back_populates="recipients")


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (
        UniqueConstraint("shoutout_id", "user_id", name="uq_reaction_shoutout_user"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    shoutout_id: Mapped[int] = mapped_column(ForeignKey("shoutouts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # like, clap, star
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut", back_populates="reactions")
    user: Mapped["User"] = relationship("User")


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    shoutout_id: Mapped[int] = mapped_column(ForeignKey("shoutouts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id"), nullable=True, index=True)

    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut", back_populates="comments")
    user: Mapped["User"] = relationship("User")
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment",
        remote_side="Comment.id",
        back_populates="children",
    )
    children: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
    )


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    shoutout_id: Mapped[int] = mapped_column(ForeignKey("shoutouts.id"), nullable=False, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # image/jpeg, image/png, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut", back_populates="attachments")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    shoutout_id: Mapped[int] = mapped_column(ForeignKey("shoutouts.id"), nullable=False, index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut", back_populates="reports")
    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id])
    resolved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[resolved_by_id])


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    shoutout_id: Mapped[int] = mapped_column(ForeignKey("shoutouts.id"), nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", backref="notifications")
    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut")


class AdminNotification(Base):
    __tablename__ = "admin_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    shoutout_id: Mapped[int | None] = mapped_column(ForeignKey("shoutouts.id"), nullable=True)
    report_id: Mapped[int | None] = mapped_column(ForeignKey("reports.id"), nullable=True)

    actor: Mapped["User"] = relationship("User")
    shoutout: Mapped["ShoutOut"] = relationship("ShoutOut")
    report: Mapped["Report"] = relationship("Report")


