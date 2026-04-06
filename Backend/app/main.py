import os
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import appointments, auth, dashboard, patients, records, users


def _parse_cors_origins() -> list[str]:
    # Allow configuring production origins via env while keeping local defaults.
    configured = os.getenv("CORS_ORIGINS", "").strip()
    if configured:
        valid: list[str] = []
        seen: set[str] = set()
        for item in configured.split(","):
            origin = item.strip().rstrip("/")
            if not origin:
                continue
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                continue
            if origin in seen:
                continue
            seen.add(origin)
            valid.append(origin)
        if valid:
            return valid

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="EHR Electronic Health Records API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(patients.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/health")
def health():
    return {"ok": True, "service": "ehr-electronic-health-records-backend"}
