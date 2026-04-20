-- CreateTable
CREATE TABLE "RoomHistory" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "startPage" TEXT NOT NULL,
    "targetPage" TEXT NOT NULL,
    "startTime" BIGINT,
    "status" "RoomStatus" NOT NULL,
    "hostId" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomHistory_roomId_createdAt_idx" ON "RoomHistory"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomHistory_roomCode_createdAt_idx" ON "RoomHistory"("roomCode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomHistory_roomId_gameNumber_key" ON "RoomHistory"("roomId", "gameNumber");

-- AddForeignKey
ALTER TABLE "RoomHistory" ADD CONSTRAINT "RoomHistory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
