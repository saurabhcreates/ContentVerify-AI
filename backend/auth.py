
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from backend.database import User, get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hash = PasswordHash.recommended()

SESSION_SECRET = os.getenv("SESSION_SECRET")
if not SESSION_SECRET:
    raise RuntimeError(
        "SESSION_SECRET is missing. Configure it in your environment before starting."
    )

serializer = URLSafeTimedSerializer(SESSION_SECRET, salt="contentverify-session")
SESSION_COOKIE = "contentverify_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(SESSION_COOKIE)

    if not token:
        raise HTTPException(status_code=401, detail="Please log in first.")

    try:
        payload = serializer.loads(token, max_age=SESSION_MAX_AGE)
        user_id = int(payload["user_id"])
    except (BadSignature, SignatureExpired, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User account was not found.")

    return user


@router.post("/register", status_code=201)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    name = data.name.strip()
    email = str(data.email).strip().lower()

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter a valid name.")

    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=name,
        email=email,
        password_hash=password_hash.hash(data.password),
    )

    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create your account.")

    return {
        "ok": True,
        "message": "Account created successfully. You can now log in.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


@router.post("/login")
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))

    if not user or not password_hash.verify(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = serializer.dumps({
        "user_id": user.id,
        "nonce": secrets.token_urlsafe(12),
    })

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
    )

    return {
        "ok": True,
        "message": "Login successful.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
    )
    return {"ok": True, "message": "Logged out successfully."}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }
