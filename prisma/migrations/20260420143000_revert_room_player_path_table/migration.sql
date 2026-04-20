-- Add path array column back to RoomPlayer
ALTER TABLE "RoomPlayer"
ADD COLUMN "path" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill path column from RoomPlayerPath rows, preserving step order
UPDATE "RoomPlayer" rp
SET "path" = aggregated.path
FROM (
  SELECT
    rpp."roomPlayerId",
    ARRAY_AGG(rpp."page" ORDER BY rpp."step") AS path
  FROM "RoomPlayerPath" rpp
  GROUP BY rpp."roomPlayerId"
) aggregated
WHERE rp."id" = aggregated."roomPlayerId";

-- Remove normalized path table (data has been copied back)
DROP TABLE "RoomPlayerPath";
