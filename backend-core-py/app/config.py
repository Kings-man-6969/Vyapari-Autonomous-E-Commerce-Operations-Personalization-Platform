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

    # API & Frontend URLs
    API_URL: str = "https://api.vyapari.live"
    FRONTEND_URL: str = "http://localhost:3000"

    # Razorpay (kept for parity with Node.js)
    RAZORPAY_KEY_ID: str = "rzp_test_placeholder_key_id"
    RAZORPAY_KEY_SECRET: str = "rzp_test_placeholder_key_secret"
    RAZORPAY_WEBHOOK_SECRET: str = "rzp_test_placeholder_webhook_secret"
    RAZORPAY_CURRENCY: str = "INR"

    # How long an unpaid order holds its stock. A pending order has already had
    # its stock decremented, so without an expiry a customer who abandons checkout
    # -- or closes the tab during the gateway's own 3-D Secure step -- leaves the
    # catalogue selling inventory nobody is holding. The sweep that acts on this
    # is in app/jobs.py.
    ORDER_PAYMENT_WINDOW_MINUTES: int = 30

    # How often the abandoned-order sweep runs, and whether it runs at all. Off by
    # default in tests, on in the app, because a background loop that writes to
    # the database is not something a test wants to race against.
    RUN_ORDER_SWEEP: bool = True
    ORDER_SWEEP_INTERVAL_SECONDS: int = 300

    # The analytics rollup (section I1). `product_stats_daily` is recomputed from
    # `user_interactions` and `order_items` rather than incremented, so the job is
    # idempotent and a gap is filled by running it again -- which is why the loop
    # is driven by "which days are missing" rather than "has the last tick run".
    #
    # 15 minutes rather than a nightly batch: the best-sellers list and the
    # product-performance screen read this table, and a figure that is a day old
    # makes "trending today" unanswerable. The work per tick is a handful of
    # grouped scans over one day's rows.
    RUN_STATS_ROLLUP: bool = True
    STATS_ROLLUP_INTERVAL_SECONDS: int = 900

    # How much history the loop will catch up on. Bounded because a first boot on
    # an empty database has nothing to recompute, and an unbounded walk would
    # query for every day since the schema was created.
    STATS_ROLLUP_WINDOW_DAYS: int = 30

    # ------------------------------------------------------------------
    # Media storage
    # ------------------------------------------------------------------
    # "local" writes to MEDIA_ROOT on the API container and serves /media.
    # That is a real, working provider with no credentials -- good enough for
    # development, a single-container self-host, or a demo, and it is the only
    # one that is exercisable end to end today.
    #
    # "s3" is the production path: the browser PUTs bytes straight to the bucket
    # with a presigned URL, so image bytes never transit the API. It needs
    # S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY. Until those are real it refuses with
    # 503 STORAGE_NOT_CONFIGURED rather than handing back a URL that 403s -- a
    # presign that cannot work is worse than an honest error, because the seller
    # only finds out after they have picked their file.
    STORAGE_PROVIDER: str = "local"

    # local provider
    MEDIA_ROOT: str = "./media"
    MEDIA_PUBLIC_BASE: str = "/media"

    # s3 provider
    S3_BUCKET_NAME: str = "vyapari-products"
    S3_REGION: str = "ap-south-1"
    S3_ENDPOINT_URL: str | None = None       # set for MinIO / R2 / LocalStack
    S3_FORCE_PATH_STYLE: bool = False
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    # Public read base (CloudFront distribution, R2 public bucket, CDN host).
    # Left empty the provider falls back to the virtual-hosted bucket URL.
    S3_PUBLIC_BASE_URL: str | None = None

    # Every stored image is re-encoded to WebP and also written at each of these
    # widths, named "{uuid}@{width}w.webp" next to the master. The width in the
    # filename is what lets the browser build a srcSet from a single stored URL
    # with no extra lookup -- see app/storage/local.py. Frontend mirrors this
    # list via GET /api/uploads/config; IMAGE_VARIANT_WIDTHS is the source.
    IMAGE_VARIANT_WIDTHS: list[int] = [200, 400, 800, 1200, 1600]
    IMAGE_MASTER_WIDTH: int = 1600
    # PNG with alpha (a logo, a pack shot on transparency) is kept as PNG;
    # re-encoding it to WebP would flatten the alpha channel.
    IMAGE_WEBP_QUALITY: int = 82
    # Decompression-bomb guard. Pillow refuses anything over this many pixels
    # unless told otherwise, which is the whole point of the check.
    IMAGE_MAX_PIXELS: int = 50_000_000

    # Transactional email. No provider is wired yet — see app/email.py, which
    # logs instead of sending. Set EMAIL_PROVIDER (and EMAIL_API_KEY for
    # resend) to turn on real delivery.
    EMAIL_PROVIDER: str | None = None
    EMAIL_API_KEY: str | None = None
    EMAIL_FROM: str = "Vyapari <no-reply@vyapari.live>"

    # Password reset token lifetime. Short on purpose: a reset link sitting in
    # an inbox for a week is a standing credential.
    PASSWORD_RESET_TOKEN_TTL_MINUTES: int = 60

    # Redis (Supports direct REDIS_URL or host/port/auth/ssl params)
    REDIS_URL: str | None = None
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None
    REDIS_DB: int = 0
    REDIS_SSL: bool = False

    @property
    def redis_connection_url(self) -> str:
        if self.REDIS_URL and self.REDIS_URL.strip():
            return self.REDIS_URL.strip()
        proto = "rediss" if self.REDIS_SSL else "redis"
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"{proto}://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def is_production(self) -> bool:
        return self.NODE_ENV == "production"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
