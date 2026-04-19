-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('waiting', 'playing', 'finished');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startPage" TEXT NOT NULL,
    "targetPage" TEXT NOT NULL,
    "startTime" BIGINT,
    "status" "RoomStatus" NOT NULL DEFAULT 'waiting',
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentPage" TEXT NOT NULL,
    "path" TEXT[],
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "gaveUp" BOOLEAN NOT NULL DEFAULT false,
    "finishTime" BIGINT,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomId_key" ON "Room"("roomId");

-- CreateIndex
CREATE INDEX "Room_createdAt_idx" ON "Room"("createdAt");

-- CreateIndex
CREATE INDEX "RoomPlayer_roomId_idx" ON "RoomPlayer"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_playerId_key" ON "RoomPlayer"("roomId", "playerId");

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
