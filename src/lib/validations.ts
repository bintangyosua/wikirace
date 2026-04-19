import { z } from "zod";

// ── Lobby: Create Room ──────────────────────────────────────
export const createRoomSchema = z
  .object({
    playerName: z
      .string()
      .trim()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .max(20, "Name can't exceed 20 characters")
      .regex(/^[a-zA-Z0-9_ ]+$/, "Name can only contain letters, numbers, spaces, and underscores"),
    useCustomPages: z.boolean(),
    startPage: z.string().optional(),
    targetPage: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.useCustomPages) {
      if (!data.startPage || data.startPage.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select a start article",
          path: ["startPage"],
        });
      }
      if (!data.targetPage || data.targetPage.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select a target article",
          path: ["targetPage"],
        });
      }
      if (
        data.startPage &&
        data.targetPage &&
        data.startPage === data.targetPage
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start and target must be different articles",
          path: ["targetPage"],
        });
      }
    }
  });

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// ── Lobby: Join Room ────────────────────────────────────────
export const joinRoomSchema = z.object({
  playerName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(20, "Name can't exceed 20 characters")
    .regex(/^[a-zA-Z0-9_ ]+$/, "Name can only contain letters, numbers, spaces, and underscores"),
  roomCode: z
    .string()
    .trim()
    .min(1, "Room code is required")
    .length(6, "Room code must be exactly 6 characters")
    .regex(/^[A-Z0-9]+$/, "Room code can only contain uppercase letters and numbers"),
});

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

// ── Game View: Join via Link ────────────────────────────────
export const joinByLinkSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(20, "Name can't exceed 20 characters")
    .regex(/^[a-zA-Z0-9_ ]+$/, "Name can only contain letters, numbers, spaces, and underscores"),
});

export type JoinByLinkInput = z.infer<typeof joinByLinkSchema>;

// ── Helper: extract first error per field ───────────────────
export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
