from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import traceback

from .config import settings
from .database import init_db, SessionLocal
from .models import Department
from .routers import auth, users, departments, health, shoutouts, admin, notifications


def create_app() -> FastAPI:
    app = FastAPI(title="BragBoard API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/media", StaticFiles(directory=settings.media_root), name="media")

    # Global exception handlers
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        error_messages = []
        for error in errors:
            field = " -> ".join(str(loc) for loc in error.get("loc", []))
            msg = error.get("msg", "Validation error")
            error_messages.append(f"{field}: {msg}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "detail": "; ".join(error_messages) if error_messages else "Validation error",
                "errors": errors
            }
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
        errors = exc.errors()
        error_messages = []
        for error in errors:
            field = " -> ".join(str(loc) for loc in error.get("loc", []))
            msg = error.get("msg", "Validation error")
            error_messages.append(f"{field}: {msg}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "detail": "; ".join(error_messages) if error_messages else "Validation error",
                "errors": errors
            }
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        # Log the full traceback for debugging (in production, use proper logging)
        traceback.print_exc()
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "detail": "An internal server error occurred. Please try again later."
            }
        )

    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(users.router, prefix="/users", tags=["users"])
    app.include_router(departments.router, prefix="/departments", tags=["departments"])
    app.include_router(shoutouts.router, prefix="/shoutouts", tags=["shoutouts"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])
    app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])

    return app


app = create_app()


@app.on_event("startup")
async def on_startup() -> None:
    init_db()
    # Seed default departments if none exist
    try:
        db = SessionLocal()
        try:
            count = db.query(Department).count()
            if count == 0:
                db.add_all([
                    Department(name="HR"),
                    Department(name="Finance"),
                    Department(name="Marketing"),
                    Department(name="Product Development"),
                    Department(name="Quality Assurance"),
                    Department(name="Security"),
                ])
                db.commit()
        finally:
            db.close()
    except Exception as e:
        # Database might not be ready yet, that's okay
        # Departments will be seeded on first successful connection
        print(f"Warning: Could not seed departments on startup: {e}")
        print("The app will continue, but departments may need to be created manually.")
