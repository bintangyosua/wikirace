-- CreateTable
CREATE TABLE "RoomPlayerPath" (
    "id" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "page" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomPlayerPath_pkey" PRIMARY KEY ("id")
);

-- Backfill existing RoomPlayer.path array into RoomPlayerPath rows
INSERT INTO "RoomPlayerPath" ("id", "roomPlayerId", "step", "page", "createdAt")
SELECT
    CONCAT('rpp_', rp."id", '_', path_items.ordinality - 1)::TEXT AS "id",
    rp."id" AS "roomPlayerId",
    (path_items.ordinality - 1)::INTEGER AS "step",
    path_items.page AS "page",
    COALESCE(rp."updatedAt", CURRENT_TIMESTAMP) AS "createdAt"
FROM "RoomPlayer" rp
CROSS JOIN LATERAL unnest(COALESCE(rp."path", ARRAY[]::TEXT[])) WITH ORDINALITY AS path_items(page, ordinality);

-- Drop old denormalized array column
ALTER TABLE "RoomPlayer" DROP COLUMN "path";

-- CreateIndex
CREATE INDEX "RoomPlayerPath_roomPlayerId_step_idx" ON "RoomPlayerPath"("roomPlayerId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayerPath_roomPlayerId_step_key" ON "RoomPlayerPath"("roomPlayerId", "step");

-- AddForeignKey
ALTER TABLE "RoomPlayerPath" ADD CONSTRAINT "RoomPlayerPath_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
