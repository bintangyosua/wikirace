"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArticleSearch } from "@/components/article-search";
import { generatePlayerId } from "@/lib/game-utils";
import {
  createRoomSchema,
  joinRoomSchema,
  getFieldErrors,
} from "@/lib/validations";
import {
  Globe,
  Users,
  Zap,
  ArrowRight,
  Loader2,
  Shuffle,
  AlertCircle,
  LogIn,
} from "lucide-react";

/** Inline field error shown below each input */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-destructive mt-1.5 animate-in slide-in-from-top-1 fade-in duration-200">
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}

export function LobbyForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("wikirace_player_name") || "";
  });
  const [roomCode, setRoomCode] = useState("");
  const [startPage, setStartPage] = useState("");
  const [targetPage, setTargetPage] = useState("");
  const [useCustomPages, setUseCustomPages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("wikirace_room_id");
  });

  const clearErrors = () => {
    setFieldErrors({});
    setServerError("");
  };

  const getOrCreatePlayerId = (): string => {
    let id = sessionStorage.getItem("wikirace_player_id");
    if (!id) {
      id = generatePlayerId();
      sessionStorage.setItem("wikirace_player_id", id);
    }
    return id;
  };

  const handleCreate = async () => {
    clearErrors();

    const result = createRoomSchema.safeParse({
      playerName,
      useCustomPages,
      startPage: startPage || undefined,
      targetPage: targetPage || undefined,
    });

    if (!result.success) {
      setFieldErrors(getFieldErrors(result.error));
      return;
    }

    setLoading(true);

    try {
      const playerId = getOrCreatePlayerId();
      sessionStorage.setItem("wikirace_player_name", result.data.playerName);

      const body: Record<string, string> = {
        hostId: playerId,
        hostName: result.data.playerName,
      };

      if (useCustomPages && startPage && targetPage) {
        body.startPage = startPage;
        body.targetPage = targetPage;
      }

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create room");
      }

      const data = await res.json();
      sessionStorage.setItem("wikirace_room_id", data.roomId);
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    clearErrors();

    const result = joinRoomSchema.safeParse({
      playerName,
      roomCode: roomCode.toUpperCase(),
    });

    if (!result.success) {
      setFieldErrors(getFieldErrors(result.error));
      return;
    }

    setLoading(true);

    try {
      const playerId = getOrCreatePlayerId();
      sessionStorage.setItem("wikirace_player_name", result.data.playerName);

      const res = await fetch(`/api/rooms/${result.data.roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName: result.data.playerName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      sessionStorage.setItem("wikirace_room_id", result.data.roomCode);
      router.push(`/room/${result.data.roomCode}`);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Return to Active Room Banner */}
      {activeRoomId && (
        <div className="w-full max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 shrink-0">
              <LogIn className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">You have an active room</p>
              <p className="text-xs text-muted-foreground">
                Room{" "}
                <span className="font-mono font-bold text-primary">
                  {activeRoomId}
                </span>
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  sessionStorage.removeItem("wikirace_room_id");
                  setActiveRoomId(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={() => router.push(`/room/${activeRoomId}`)}
                className="gap-1.5 h-8"
              >
                Return
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => {
            setMode("create");
            clearErrors();
          }}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
            mode === "create"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Create Room
        </button>
        <button
          onClick={() => {
            setMode("join");
            clearErrors();
          }}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
            mode === "join"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Join Room
        </button>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-md border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === "create" ? "Create a New Room" : "Join a Room"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Start a new WikiRace and invite friends"
              : "Enter a room code to join an existing game"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Player Name */}
          <div className="space-y-1">
            <label htmlFor="player-name" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="player-name"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                if (fieldErrors.playerName) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.playerName;
                    return next;
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && mode === "join") handleJoin();
                if (e.key === "Enter" && mode === "create") handleCreate();
              }}
              maxLength={20}
              disabled={loading}
              className={
                fieldErrors.playerName
                  ? "border-destructive/60 focus-visible:ring-destructive/30"
                  : ""
              }
            />
            <FieldError message={fieldErrors.playerName} />
          </div>

          {/* Room Code (Join mode) */}
          {mode === "join" && (
            <div className="space-y-1">
              <label htmlFor="room-code" className="text-sm font-medium">
                Room Code
              </label>
              <Input
                id="room-code"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  if (fieldErrors.roomCode) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.roomCode;
                      return next;
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                maxLength={6}
                className={`uppercase tracking-widest text-center font-mono text-lg ${
                  fieldErrors.roomCode
                    ? "border-destructive/60 focus-visible:ring-destructive/30"
                    : ""
                }`}
                disabled={loading}
              />
              <FieldError message={fieldErrors.roomCode} />
            </div>
          )}

          {/* Article Selection (Create mode only) */}
          {mode === "create" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Articles</label>
                <button
                  type="button"
                  onClick={() => setUseCustomPages(!useCustomPages)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {useCustomPages ? (
                    <>
                      <Shuffle className="size-3" />
                      Use random instead
                    </>
                  ) : (
                    <>
                      <Globe className="size-3" />
                      Choose articles
                    </>
                  )}
                </button>
              </div>

              {useCustomPages ? (
                <div className="space-y-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                  <div>
                    <ArticleSearch
                      id="start-article"
                      label="Start Article"
                      placeholder="Type to search..."
                      value={startPage}
                      onChange={(val) => {
                        setStartPage(val);
                        if (fieldErrors.startPage) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.startPage;
                            return next;
                          });
                        }
                      }}
                    />
                    <FieldError message={fieldErrors.startPage} />
                  </div>
                  <div>
                    <ArticleSearch
                      id="target-article"
                      label="Target Article"
                      placeholder="Type to search..."
                      value={targetPage}
                      onChange={(val) => {
                        setTargetPage(val);
                        if (fieldErrors.targetPage) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.targetPage;
                            return next;
                          });
                        }
                      }}
                    />
                    <FieldError message={fieldErrors.targetPage} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded-lg border border-border/40">
                  <Shuffle className="size-3 inline mr-1" />
                  Start &amp; target articles will be randomly selected
                </p>
              )}
            </div>
          )}

          {/* Server Error */}
          {serverError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="size-4 shrink-0" />
              {serverError}
            </div>
          )}

          <Button
            onClick={mode === "create" ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {mode === "create" ? "Creating..." : "Joining..."}
              </>
            ) : (
              <>
                {mode === "create" ? "Create Room" : "Join Room"}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 w-full max-w-2xl">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/50 p-4 backdrop-blur-sm text-center">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
            <Globe className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Navigate Wikipedia</p>
          <p className="text-xs text-muted-foreground">
            Click through real articles
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/50 p-4 backdrop-blur-sm text-center">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Race Friends</p>
          <p className="text-xs text-muted-foreground">Compete in real-time</p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/50 p-4 backdrop-blur-sm text-center">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
            <Zap className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Fewest Steps Wins</p>
          <p className="text-xs text-muted-foreground">Strategy beats speed</p>
        </div>
      </div>
    </div>
  );
}
