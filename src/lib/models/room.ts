import mongoose, { Schema, type Document } from "mongoose";

// ─── Player Sub-Schema ────────────────────────────────────
const PlayerSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    currentPage: { type: String, required: true },
    path: { type: [String], default: [] },
    finished: { type: Boolean, default: false },
    gaveUp: { type: Boolean, default: false },
    finishTime: { type: Number, default: null },
    steps: { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Room Schema ──────────────────────────────────────────
export interface IRoomDocument extends Document {
  roomId: string;
  startPage: string;
  targetPage: string;
  startTime: number | null;
  players: Map<
    string,
    {
      id: string;
      name: string;
      currentPage: string;
      path: string[];
      finished: boolean;
      gaveUp: boolean;
      finishTime: number | null;
      steps: number;
    }
  >;
  status: "waiting" | "playing" | "finished";
  hostId: string;
  createdAt: Date;
}

const RoomSchema = new Schema<IRoomDocument>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    startPage: { type: String, required: true },
    targetPage: { type: String, required: true },
    startTime: { type: Number, default: null },
    players: { type: Map, of: PlayerSchema, default: new Map() },
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
    },
    hostId: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// Auto-expire rooms after 24 hours
RoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// Prevent model recompilation in dev hot reloads
export const RoomModel =
  (mongoose.models.Room as mongoose.Model<IRoomDocument>) ||
  mongoose.model<IRoomDocument>("Room", RoomSchema);
