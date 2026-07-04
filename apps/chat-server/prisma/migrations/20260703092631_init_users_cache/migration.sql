-- CreateTable
CREATE TABLE "users_cache" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar_url" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_cache_pkey" PRIMARY KEY ("id")
);
