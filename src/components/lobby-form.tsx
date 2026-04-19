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
import { Globe, Users, Zap, ArrowRight, Loader2, Shuffle } from "lucide-react";

export function LobbyForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [startPage, setStartPage] = useState("");
  const [targetPage, setTargetPage] = useState("");
  const [useCustomPages, setUseCustomPages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getOrCreatePlayerId = (): string => {
    let id = sessionStorage.getItem("wikirace_player_id");
    if (!id) {
      id = generatePlayerId();
      sessionStorage.setItem("wikirace_player_id", id);
    }
    return id;
  };

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (useCustomPages) {
      if (!startPage) {
        setError("Please select a start article");
        return;
      }
      if (!targetPage) {
        setError("Please select a target article");
        return;
      }
      if (startPage === targetPage) {
        setError("Start and target must be different articles");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const playerId = getOrCreatePlayerId();
      sessionStorage.setItem("wikirace_player_name", playerName.trim());

      const body: Record<string, string> = {
        hostId: playerId,
        hostName: playerName.trim(),
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
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const playerId = getOrCreatePlayerId();
      sessionStorage.setItem("wikirace_player_name", playerName.trim());

      const res = await fetch(`/api/rooms/${roomCode.trim().toUpperCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName: playerName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      router.push(`/room/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Mode Toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => { setMode("create"); setError(""); }}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
            mode === "create"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Create Room
        </button>
        <button
          onClick={() => { setMode("join"); setError(""); }}
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
          <div className="space-y-2">
            <label htmlFor="player-name" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="player-name"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && mode === "join") handleJoin();
              }}
              maxLength={20}
              disabled={loading}
            />
          </div>

          {mode === "join" && (
            <div className="space-y-2">
              <label htmlFor="room-code" className="text-sm font-medium">
                Room Code
              </label>
              <Input
                id="room-code"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                maxLength={6}
                className="uppercase tracking-widest text-center font-mono text-lg"
                disabled={loading}
              />
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
                  <ArticleSearch
                    id="start-article"
                    label="Start Article"
                    placeholder="Type to search..."
                    value={startPage}
                    onChange={setStartPage}
                  />
                  <ArticleSearch
                    id="target-article"
                    label="Target Article"
                    placeholder="Type to search..."
                    value={targetPage}
                    onChange={setTargetPage}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded-lg border border-border/40">
                  <Shuffle className="size-3 inline mr-1" />
                  Start & target articles will be randomly selected
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
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
          <p className="text-xs text-muted-foreground">
            Compete in real-time
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/50 p-4 backdrop-blur-sm text-center">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
            <Zap className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Fewest Steps Wins</p>
          <p className="text-xs text-muted-foreground">
            Strategy beats speed
          </p>
        </div>
      </div>
    </div>
  );
}
