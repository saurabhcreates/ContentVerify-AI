from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

import tempfile
import os
import uuid

from datetime import datetime, timezone

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import Analysis, User, get_db
from backend.auth import current_user

from functools import lru_cache

import cv2
import torch
from PIL import Image, UnidentifiedImageError
from transformers import pipeline
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.database import create_tables
from backend.auth import router as auth_router


FRONTEND = ROOT / "frontend"

MAX_BYTES = 100 * 1024 * 1024

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}

MODEL_NAME = "delpot/steganograph-ia-detector"

app = FastAPI(
    title="ContentVerify AI API",
    description="Media validation and pretrained image deepfake classification.",
    version="0.2.0",
)
create_tables()
app.include_router(auth_router)

app.mount("/static", StaticFiles(directory=FRONTEND), name="static")



@lru_cache(maxsize=1)
def get_detector():
    """Load and inspect the configured image detector."""
    detector = pipeline(
        "image-classification",
        model=MODEL_NAME,
        device=-1,
    )

    print("\n========== LOADED MODEL ==========")
    print("Configured model:", MODEL_NAME)
    print("Model configuration:", detector.model.config._name_or_path)
    print("Model class:", type(detector.model).__name__)
    print("Configured labels:", detector.model.config.id2label)
    print("==================================\n")

    return detector




@app.get("/")
def home():
    return FileResponse(FRONTEND / "index.html")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "ContentVerify AI",
        "detector_connected": True,
        "model": MODEL_NAME,
        "device": "CPU",
    }
@app.get("/api/history")
def get_history(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    records = db.scalars(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
    ).all()

    return {
        "ok": True,
        "total": len(records),
        "history": [
            {
                "id": record.id,
                "filename": record.filename,
                "media_type": record.media_type,
                "prediction": record.prediction,
                "confidence": record.confidence,
                "model_name": record.model_name,
                "status": record.status,
                "created_at": (
                    record.created_at.isoformat()
                    if record.created_at else None
                ),
            }
            for record in records
        ],
    }


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    content_type = (file.content_type or "").lower()

    if content_type not in IMAGE_TYPES | VIDEO_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported type. Upload JPG, PNG, WEBP, MP4, MOV, or WEBM.",
        )

    suffix = Path(file.filename or "").suffix.lower()
    temp_path = None
    total = 0

    try:
        # Save the uploaded file temporarily and enforce the size limit.
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temp:
            temp_path = temp.name

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total += len(chunk)

                if total > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the 100 MB demo limit.",
                    )

                temp.write(chunk)

        if total == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty.",
            )

        # IMAGE ANALYSIS
        if content_type in IMAGE_TYPES:
            try:
                with Image.open(temp_path) as source_image:
                    source_image.verify()

                with Image.open(temp_path) as source_image:
                    image = source_image.convert("RGB")
                    width, height = image.size

                    # Run the pretrained classifier.
                    predictions = get_detector()(image, top_k=None)

                    print("\n========== DETECTION DEBUG ==========")
                    print("Image:", file.filename)
                    print("Model:", MODEL_NAME)
                    print("Raw predictions:", predictions)
                    print("====================================\n")

            except (UnidentifiedImageError, OSError, ValueError) as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Image could not be decoded or analyzed.",
                ) from exc

            if not predictions:
                raise HTTPException(
                    status_code=500,
                    detail="The model returned no predictions.",
                )

            # Return the highest-scoring model prediction.
            best = max(predictions, key=lambda item: item["score"])
            label = str(best["label"])
            confidence = float(best["score"])

            normalized_label = label.strip().lower().replace("-", "_").replace(" ", "_")
             
            if normalized_label == "real":
                 result = "REAL"
            elif normalized_label == "ai_generated":
                 result = "FAKE"
            else:
                 result = "UNCLASSIFIED"

            detection = {
                "label": result,
                "model_label": label,
                "confidence": round(confidence, 4),
                "confidence_percent": round(confidence * 100, 2),
                "model": MODEL_NAME,
                "type": "image_classification",
                "warning": (
                    "This is a model prediction, not proof of authenticity. "
                    "Performance may vary on unfamiliar images."
                ),
            }

            details = {
                "kind": "image",
                "bytes_received": total,
                "width": width,
                "height": height,
                "validation": "Image decoded successfully",
            }
            record = Analysis(
               user_id=user.id,
               filename=file.filename or "uploaded_file",
               stored_filename=None,
               media_type="image",
               prediction=detection["label"],
               confidence=detection["confidence"],
               model_name=detection["model"],
               status="analyzed",
               notes=detection.get("warning"),
            )

            db.add(record)
            db.commit()
            db.refresh(record)
   

            return {
                "ok": True,
                "filename": file.filename,
                "status": "analyzed",
                "message": (
                    "Image analysis completed using a pretrained "
                    "deepfake image classifier."
                ),
                "detection": detection,
                "details": details,
            }

        # VIDEO VALIDATION ONLY — no video deepfake detector is connected.
        capture = cv2.VideoCapture(temp_path)

        try:
            if not capture.isOpened():
                raise HTTPException(
                    status_code=400,
                    detail="Video could not be opened.",
                )

            frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = float(capture.get(cv2.CAP_PROP_FPS))

            details = {
                "kind": "video",
                "bytes_received": total,
                "frame_count": frame_count,
                "fps": round(fps, 2),
                "duration_seconds": (
                    round(frame_count / fps, 2) if fps > 0 else None
                ),
                "validation": "Video opened successfully",
            }

        finally:
            capture.release()

        return {
            "ok": True,
            "filename": file.filename,
            "status": "validated_only",
            "message": (
                "Video validation completed. Video deepfake detection "
                "is not implemented; no AI prediction was made."
            ),
            "detection": None,
            "details": details,
        }

    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
