import csv
import importlib
import io
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import schemas
from ..deps import get_db, require_admin
from ..models import AdminNotification, Report, ShoutOut, ShoutOutRecipient, User

router = APIRouter()


@router.get("/metrics", response_model=schemas.AdminMetrics)
def get_admin_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> schemas.AdminMetrics:
    top_contributors = (
        db.query(User, func.count(ShoutOut.id).label("count"))
        .join(ShoutOut, ShoutOut.created_by_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOut.id).desc())
        .limit(5)
        .all()
    )
    most_tagged = (
        db.query(User, func.count(ShoutOutRecipient.shoutout_id).label("count"))
        .join(ShoutOutRecipient, ShoutOutRecipient.user_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOutRecipient.shoutout_id).desc())
        .limit(5)
        .all()
    )
    return schemas.AdminMetrics(
        top_contributors=[
            schemas.UserStat(user=user, count=count) for user, count in top_contributors
        ],
        most_tagged=[
            schemas.UserStat(user=user, count=count) for user, count in most_tagged
        ],
    )


def _validate_status_filter(status_filter: Optional[str]) -> None:
    if status_filter and status_filter not in {"open", "resolved"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'open' or 'resolved'",
        )


def _base_report_query(db: Session):
    q = db.query(Report).options(
        selectinload(Report.shoutout)
        .selectinload(ShoutOut.created_by),
        selectinload(Report.reporter),
        selectinload(Report.resolved_by),
    )
    return q


@router.get("/reports", response_model=List[schemas.ReportOut])
def list_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> List[schemas.ReportOut]:
    _validate_status_filter(status_filter)
    q = _base_report_query(db)
    if status_filter:
        q = q.filter(Report.status == status_filter)
    reports = q.order_by(Report.created_at.desc()).all()
    return reports


@router.get("/notifications", response_model=List[schemas.AdminNotificationOut])
def list_admin_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> List[schemas.AdminNotificationOut]:
    query = (
        db.query(AdminNotification)
        .options(selectinload(AdminNotification.actor))
        .order_by(AdminNotification.created_at.desc())
    )
    if event_type:
        query = query.filter(AdminNotification.event_type == event_type)
    notifications = query.offset(offset).limit(limit).all()
    return notifications


@router.post("/reports/{report_id}/resolve", response_model=schemas.ReportOut)
def resolve_report(
    report_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> schemas.ReportOut:
    report = (
        db.query(Report)
        .options(
            selectinload(Report.shoutout).selectinload(ShoutOut.created_by),
            selectinload(Report.reporter),
            selectinload(Report.resolved_by),
        )
        .filter(Report.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if report.status == "resolved":
        return report
    report.status = "resolved"
    report.resolved_at = datetime.utcnow()
    report.resolved_by_id = admin_user.id
    db.commit()
    report = (
        db.query(Report)
        .options(
            selectinload(Report.shoutout).selectinload(ShoutOut.created_by),
            selectinload(Report.reporter),
            selectinload(Report.resolved_by),
        )
        .filter(Report.id == report_id)
        .first()
    )
    return report


@router.get("/reports/export")
def export_reports(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    _validate_status_filter(status_filter)
    q = _base_report_query(db)
    if status_filter:
        q = q.filter(Report.status == status_filter)
    reports = q.order_by(Report.created_at.desc()).all()
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Report ID",
                "Status",
                "Reporter",
                "Reason",
                "Shout-Out ID",
                "Shout-Out Author",
                "Reported At",
                "Resolved At",
            ]
        )
        for report in reports:
            writer.writerow(
                [
                    report.id,
                    report.status,
                    report.reporter.full_name,
                    report.reason or "",
                    report.shoutout.id,
                    report.shoutout.created_by.full_name,
                    report.created_at.isoformat(),
                    report.resolved_at.isoformat() if report.resolved_at else "",
                ]
            )
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=reports-{timestamp}.csv"
            },
        )

    # PDF export
    try:
        pdfgen_module = importlib.import_module("reportlab.pdfgen.canvas")
        pagesizes_module = importlib.import_module("reportlab.lib.pagesizes")
        utils_module = importlib.import_module("reportlab.lib.utils")
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF export is not available on the server.",
        ) from exc

    canvas_cls = getattr(pdfgen_module, "Canvas")
    letter = getattr(pagesizes_module, "letter")
    simpleSplit = getattr(utils_module, "simpleSplit")

    buffer = io.BytesIO()
    pdf = canvas_cls(buffer, pagesize=letter)
    width, height = letter
    y = height - 50

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, "BragBoard Report Summary")
    y -= 25
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y, f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    y -= 20

    if not reports:
        pdf.drawString(40, y, "No reports found for the selected filter.")
    else:
        for report in reports:
            lines = [
                f"Report #{report.id} - {report.status.upper()}",
                f"Reporter: {report.reporter.full_name} | Shout-Out #{report.shoutout.id} by {report.shoutout.created_by.full_name}",
                f"Reported: {report.created_at.strftime('%Y-%m-%d %H:%M')}",
            ]
            if report.resolved_at:
                lines.append(f"Resolved: {report.resolved_at.strftime('%Y-%m-%d %H:%M')}")
            if report.reason:
                lines.extend(simpleSplit(f"Reason: {report.reason}", "Helvetica", 10, width - 80))
            lines.extend(simpleSplit(f"Content: {report.shoutout.content}", "Helvetica", 10, width - 80))
            lines.append("")

            for line in lines:
                if y < 60:
                    pdf.showPage()
                    y = height - 50
                    pdf.setFont("Helvetica", 10)
                pdf.drawString(40, y, line)
                y -= 14

    pdf.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=reports-{timestamp}.pdf"
        },
    )


@router.get("/leaderboard", response_model=List[schemas.LeaderboardEntry])
def leaderboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    sent_counts = dict(
        db.query(ShoutOut.created_by_id, func.count(ShoutOut.id))
        .group_by(ShoutOut.created_by_id)
        .all()
    )
    received_counts = dict(
        db.query(ShoutOutRecipient.user_id, func.count(ShoutOutRecipient.shoutout_id))
        .group_by(ShoutOutRecipient.user_id)
        .all()
    )
    user_ids = set(sent_counts.keys()) | set(received_counts.keys())
    if not user_ids:
        return []

    users = (
        db.query(User)
        .options(selectinload(User.department))
        .filter(User.id.in_(user_ids))
        .all()
    )
    user_by_id = {user.id: user for user in users}

    entries: List[schemas.LeaderboardEntry] = []
    for user_id in user_ids:
        user = user_by_id.get(user_id)
        if not user:
            continue
        sent = sent_counts.get(user_id, 0)
        received = received_counts.get(user_id, 0)
        points = sent * 2 + received
        entries.append(
            schemas.LeaderboardEntry(
                user=user,
                shoutouts_sent=sent,
                shoutouts_received=received,
                points=points,
            )
        )

    entries.sort(key=lambda entry: entry.points, reverse=True)
    return entries[:10]

