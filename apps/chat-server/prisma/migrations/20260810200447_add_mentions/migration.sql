-- CreateTable
CREATE TABLE "mentions" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "mentioned_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentions_mentioned_user_id_idx" ON "mentions"("mentioned_user_id");

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
