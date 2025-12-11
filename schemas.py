import re
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, EmailStr, field_validator

# Password must have: uppercase, lowercase, number, special char, min 8 chars
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-={}\[\]|;:'\",.<>/?]).{8,}$")


class DepartmentBase(BaseModel):
    name: str


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    department_id: Optional[int] = None


class UserCreate(UserBase):
    password: str
    admin_code: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not PASSWORD_REGEX.match(value):
            raise ValueError(
                "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character."
            )
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    avatar_url: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not PASSWORD_REGEX.match(value):
            raise ValueError(
                "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character."
            )
        return value


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_admin: bool
    avatar_url: Optional[str] = None
    department: Optional[DepartmentOut] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class ReactionBase(BaseModel):
    type: str  # like, clap, star

class ReactionCreate(ReactionBase):
    pass

class ReactionOut(ReactionBase):
    id: int
    user: UserOut
    created_at: datetime
    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Comment content cannot be empty.")
        return value.strip()

class CommentCreate(CommentBase):
    parent_id: Optional[int] = None

class CommentOut(CommentBase):
    id: int
    user: UserOut
    created_at: datetime
    parent_id: Optional[int] = None
    class Config:
        from_attributes = True

class AttachmentBase(BaseModel):
    file_url: str
    file_name: str
    file_type: str

class AttachmentOut(AttachmentBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


class ShoutOutSummary(BaseModel):
    id: int
    content: str
    created_at: datetime
    created_by: UserOut

    class Config:
        from_attributes = True

class ShoutOutBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    department_id: Optional[int] = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Shout-out content cannot be empty.")
        return value.strip()

class ShoutOutCreate(ShoutOutBase):
    recipient_ids: List[int] = Field(..., min_length=1)

    @field_validator("recipient_ids")
    @classmethod
    def validate_recipients(cls, value: List[int]) -> List[int]:
        if not value or len(value) == 0:
            raise ValueError("At least one recipient is required.")
        return value

class ShoutOutOut(ShoutOutBase):
    id: int
    created_at: datetime
    created_by: UserOut
    recipients: List[UserOut]
    reactions: List[ReactionOut]
    comments: List[CommentOut]
    attachments: List[AttachmentOut] = Field(default_factory=list)
    class Config:
        from_attributes = True


class UserStat(BaseModel):
    user: UserOut
    count: int

    class Config:
        from_attributes = True


class AdminMetrics(BaseModel):
    top_contributors: List[UserStat]
    most_tagged: List[UserStat]


class LeaderboardEntry(BaseModel):
    user: UserOut
    shoutouts_sent: int
    shoutouts_received: int
    points: int

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value.strip() and len(value.strip()) < 5:
            raise ValueError("Report reason must be at least 5 characters long if provided.")
        return value.strip() if value else None


class ReportOut(BaseModel):
    id: int
    status: str
    reason: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    shoutout: ShoutOutSummary
    reporter: UserOut
    resolved_by: Optional[UserOut] = None

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: int
    user_id: int
    shoutout: ShoutOutOut
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCount(BaseModel):
    unread_count: int


class AdminNotificationOut(BaseModel):
    id: int
    event_type: str
    message: str
    created_at: datetime
    actor: UserOut
    shoutout_id: Optional[int] = None
    report_id: Optional[int] = None

    class Config:
        from_attributes = True


