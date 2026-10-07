from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Smart Home Service Management & Recommendation Platform"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/smart_home"

    SECRET_KEY: str  # required: no insecure default
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 5

    APP_TIMEZONE: str = "Asia/Dhaka"
    MIN_BOOKING_LEAD_MINUTES: int = 60
    MAX_SLOT_RANGE_DAYS: int = 31

    SEED_ADMIN_EMAIL: str = "admin@smarthome.com"
    SEED_ADMIN_PASSWORD: str = "Admin12345"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
