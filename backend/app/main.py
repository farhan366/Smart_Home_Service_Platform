from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import addresses, auth, providers, services

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0", docs_url="/docs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Module 1
for module in (auth, addresses, services, providers):
    app.include_router(module.router, prefix=settings.API_V1_PREFIX)

# Module 2 / 3 plug in here without touching anything above:
#   app.include_router(bookings.router, prefix=settings.API_V1_PREFIX)
#   app.include_router(disputes.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
