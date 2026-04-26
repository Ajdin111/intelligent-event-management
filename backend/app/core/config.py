from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Redis
    REDIS_URL: str = ""

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # App
    APP_ENV: str = "development"
    DEBUG: bool = False

    # CORS — override with comma-separated origins in .env:
    # CORS_ORIGINS='["https://myapp.com","https://www.myapp.com"]'
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = "../.env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
