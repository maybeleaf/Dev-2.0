import hashlib
import hmac
import os
import secrets

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.db import get_connection

router = APIRouter()


class Credentials(BaseModel):
    email: str
    password: str


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split(":")
    candidate = hash_password(password, bytes.fromhex(salt_hex)).split(":")[1]
    return hmac.compare_digest(candidate, digest_hex)


def new_session(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id)
    )
    return token


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """Dependency: the logged-in user, or a 401 error."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not logged in")
    token = authorization[len("Bearer "):]
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT users.id, users.email FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return {"id": row["id"], "email": row["email"]}


@router.post("/signup")
def signup(creds: Credentials) -> dict[str, str]:
    email = creds.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email.")
    if len(creds.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters."
        )
    with get_connection() as conn:
        exists = conn.execute(
            "SELECT 1 FROM users WHERE email = ?", (email,)
        ).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Email already registered.")
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, hash_password(creds.password)),
        )
        token = new_session(conn, cursor.lastrowid)
    return {"token": token, "email": email}


@router.post("/login")
def login(creds: Credentials) -> dict[str, str]:
    email = creds.email.strip().lower()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
        if row is None or not verify_password(creds.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Wrong email or password.")
        token = new_session(conn, row["id"])
    return {"token": token, "email": email}


@router.get("/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    return current_user(authorization)


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, bool]:
    if authorization and authorization.startswith("Bearer "):
        with get_connection() as conn:
            conn.execute(
                "DELETE FROM sessions WHERE token = ?",
                (authorization[len("Bearer "):],),
            )
    return {"ok": True}