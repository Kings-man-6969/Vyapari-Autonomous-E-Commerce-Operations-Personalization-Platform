import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = (
        "postgresql://vyapari_admin:vyapari_secure_password@db:5432/vyapari"
    )
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vyapari"
    POSTGRES_USER: str = "vyapari_admin"
    POSTGRES_PASSWORD: str = "vyapari_secure_password"

    # JWT — SAME secrets as Node.js so existing sessions survive cutover
    JWT_ACCESS_SECRET: str = (
        "vyapari_jwt_access_secret_sample_key_change_in_production_384b"
    )
    JWT_REFRESH_SECRET: str = (
        "vyapari_jwt_refresh_secret_sample_key_change_in_production_384b"
    )
    JWT_ACCESS_EXPIRES_IN: str = "15m"
    JWT_REFRESH_EXPIRES_IN: str = "7d"

    # Env
    NODE_ENV: str = "development"

    # Service URLs
    RECOMMENDATION_SERVICE_URL: str = "http://service-recommendation:8001"
    SELLER_AGENT_SERVICE_URL: str = "http://service-seller-agent:8002"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Razorpay (kept for parity with Node.js)
    RAZORPAY_KEY_ID: str = "rzp_test_placeholder_key_id"
    RAZORPAY_KEY_SECRET: str = "rzp_test_placeholder_key_secret"
    RAZORPAY_WEBHOOK_SECRET: str = "rzp_test_placeholder_webhook_secret"

    # S3 Storage
    S3_BUCKET_NAME: str = "vyapari-products"

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    @property
    def is_production(self) -> bool:
        return self.NODE_ENV == "production"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
