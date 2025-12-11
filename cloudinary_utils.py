from typing import Optional
from fastapi import UploadFile, HTTPException, status

from .config import settings

# Try to import cloudinary, but make it optional
try:
    import cloudinary
    import cloudinary.uploader
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False
    cloudinary = None
    cloudinary_uploader = None

# Initialize Cloudinary if credentials are provided and module is available
_cloudinary_initialized = False
if CLOUDINARY_AVAILABLE:
    cloud_name = settings.cloudinary_cloud_name
    api_key = settings.cloudinary_api_key
    api_secret = settings.cloudinary_api_secret
    
    if cloud_name and api_key and api_secret:
        try:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
            )
            _cloudinary_initialized = True
        except Exception as e:
            _cloudinary_initialized = False
            # Log error but don't fail - will be caught in upload function

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


async def upload_image_to_cloudinary(file: UploadFile, folder: str = "shoutouts") -> dict:
    """
    Upload an image file to Cloudinary.
    Returns a dict with 'url', 'public_id', and 'secure_url'.
    Falls back to None if Cloudinary is not configured.
    """
    if not CLOUDINARY_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload service is not available. Cloudinary package is not installed."
        )
    
    # Re-check and initialize Cloudinary if needed (in case env vars were loaded after module import)
    cloud_name = settings.cloudinary_cloud_name
    api_key = settings.cloudinary_api_key
    api_secret = settings.cloudinary_api_secret
    
    if not cloud_name or not api_key or not api_secret:
        missing = []
        if not cloud_name:
            missing.append("CLOUDINARY_CLOUD_NAME")
        if not api_key:
            missing.append("CLOUDINARY_API_KEY")
        if not api_secret:
            missing.append("CLOUDINARY_API_SECRET")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Image upload service is not configured. Missing environment variables: {', '.join(missing)}. Please check your .env file in the backend directory."
        )
    
    # Initialize Cloudinary if not already initialized
    global _cloudinary_initialized
    if not _cloudinary_initialized:
        try:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
            )
            _cloudinary_initialized = True
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to initialize Cloudinary: {str(e)}"
            )

    # Validate content type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES.keys())}"
        )

    # Read file content
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # Validate file size
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image size exceeds maximum allowed size of {MAX_IMAGE_SIZE // (1024 * 1024)}MB."
        )

    try:
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            resource_type="image",
            allowed_formats=["jpg", "jpeg", "png", "gif", "webp"],
        )
        return {
            "url": result.get("secure_url") or result.get("url"),
            "public_id": result.get("public_id"),
            "format": result.get("format"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


def delete_image_from_cloudinary(public_id: str) -> None:
    """Delete an image from Cloudinary by public_id."""
    if not CLOUDINARY_AVAILABLE:
        return
    if not settings.cloudinary_cloud_name:
        return
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        # Silently fail if deletion fails
        pass

