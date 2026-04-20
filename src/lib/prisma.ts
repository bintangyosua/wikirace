import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;
type PrismaClientWithDelegates = PrismaClientInstance & {
  room: unknown;
  roomPlayer: unknown;
  roomHistory: unknown;
};

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClientInstance;
};

function createPrismaClient(): PrismaClientInstance {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function hasRequiredDelegates(
  client: PrismaClientInstance | undefined,
): client is PrismaClientWithDelegates {
  if (!client) {
    return false;
  }

  return "room" in client && "roomPlayer" in client && "roomHistory" in client;
}

const cachedClient = globalForPrisma.prisma;

export const prisma = hasRequiredDelegates(cachedClient)
  ? cachedClient
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
