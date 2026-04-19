"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStream } from "@/hooks/use-game-stream";
import { GameHeader } from "@/components/game-header";
import { ArticleRenderer } from "@/components/article-renderer";
import { PlayerSidebar } from "@/components/player-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generatePlayerId } from "@/lib/game-utils";
import {
  Copy,
  Check,
  Play,
  Loader2,
  WifiOff,
  Trophy,
  Share2,
  ArrowRight,
} from "lucide-react";

interface GameViewProps {
  roomId: string;
}

export function GameView({ roomId }: GameViewProps) {
  const router = useRouter();
  const { room, connected } = useGameStream(roomId);

  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // For link-join flow: user needs to enter name
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Load player info from sessionStorage
  useEffect(() => {
    const id = sessionStorage.getItem("wikirace_player_id") || "";
    const name = sessionStorage.getItem("wikirace_player_name") || "";
    setPlayerId(id);
    setPlayerName(name);

    // If no name, show name entry form instead of redirecting
    if (!name) {
      setNeedsName(true);
    }
  }, []);

  // Auto-join room once we have room data + player info (for users who came from lobby)
  useEffect(() => {
    if (!room || !playerId || !playerName || needsName) return;

    // Already in the room
    if (room.players[playerId]) return;

    // Auto-join if room is in waiting state
    if (room.status === "waiting") {
      fetch(`/api/rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName }),
      }).catch((err) => console.error("Auto-join failed:", err));
    }
  }, [room, playerId, playerName, roomId, needsName]);

  // Sync current page from room state
  useEffect(() => {
    if (room && playerId && room.players[playerId]) {
      setCurrentPage(room.players[playerId].currentPage);
    } else if (room) {
      setCurrentPage(room.startPage);
    }
  }, [room, playerId]);

  // Redirect to results when player's game is finished
  useEffect(() => {
    if (room && playerId && room.players[playerId]?.finished) {
      const timer = setTimeout(() => {
        router.push(`/room/${roomId}/results`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [room, playerId, roomId, router]);

  // ── Join via link: enter name and join ─────────────────────
  const handleLinkJoin = async () => {
    if (!nameInput.trim()) {
      setJoinError("Please enter your name");
      return;
    }

    setJoining(true);
    setJoinError("");

    try {
      let id = sessionStorage.getItem("wikirace_player_id");
      if (!id) {
        id = generatePlayerId();
        sessionStorage.setItem("wikirace_player_id", id);
      }
      sessionStorage.setItem("wikirace_player_name", nameInput.trim());

      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: id,
          playerName: nameInput.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      setPlayerId(id);
      setPlayerName(nameInput.trim());
      setNeedsName(false);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setJoining(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/room/${roomId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "WikiRace — Join my game!",
          text: `Join my WikiRace game! Room code: ${roomId}`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        if ((err as Error).name !== "AbortError") {
          handleCopyCode();
        }
      }
    } else {
      // Fallback: copy link
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartGame = async () => {
    setStarting(true);
    try {
      await fetch(`/api/rooms/${roomId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setStarting(false);
    }
  };

  const handleNavigate = useCallback(
    async (title: string) => {
      if (navigating || !room || room.status !== "playing") return;

      setNavigating(true);
      setCurrentPage(title); // Optimistic update

      try {
        const res = await fetch(`/api/rooms/${roomId}/navigate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, page: title }),
        });

        if (!res.ok) {
          if (room.players[playerId]) {
            setCurrentPage(room.players[playerId].currentPage);
          }
        }
      } catch (err) {
        console.error("Navigation failed:", err);
        if (room?.players[playerId]) {
          setCurrentPage(room.players[playerId].currentPage);
        }
      } finally {
        setNavigating(false);
      }
    },
    [navigating, room, roomId, playerId]
  );

  // ── Name Entry (join via link) ────────────────────────────
  if (needsName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-sm border-border/40">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Join WikiRace</CardTitle>
            <CardDescription>
              Enter your name to join room <span className="font-mono font-bold text-primary">{roomId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <label htmlFor="join-name" className="text-sm font-medium">
                Your Name
              </label>
              <Input
                id="join-name"
                placeholder="Enter your name..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLinkJoin();
                }}
                maxLength={20}
                disabled={joining}
                autoFocus
              />
            </div>
            {joinError && (
              <p className="text-sm text-destructive text-center">{joinError}</p>
            )}
            <Button
              onClick={handleLinkJoin}
              disabled={joining}
              className="w-full gap-2"
              size="lg"
            >
              {joining ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Join Room
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-screen gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Connecting to room...</span>
      </div>
    );
  }

  const isHost = room.hostId === playerId;
  const me = room.players[playerId];
  const playerCount = Object.keys(room.players).length;

  // ── Waiting Room ──────────────────────────────────────────
  if (room.status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        {/* Connection status */}
        {!connected && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <WifiOff className="size-4" />
            Reconnecting...
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Waiting Room</h1>
          <p className="text-muted-foreground">
            Share the link or room code with your friends
          </p>
        </div>

        {/* Room Code + Share */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-5xl font-bold tracking-[0.3em] text-primary">
              {roomId}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyCode}
              title="Copy room code"
              className="shrink-0"
            >
              {copied ? (
                <Check className="size-5 text-emerald-500" />
              ) : (
                <Copy className="size-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {playerCount} player{playerCount !== 1 ? "s" : ""} in room
          </p>

          {/* Share Button */}
          <Button
            variant="outline"
            onClick={handleShare}
            className="gap-2"
          >
            <Share2 className="size-4" />
            Share Invite Link
          </Button>
        </div>

        {/* Route Preview */}
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/40 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Race Route
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{room.startPage}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline">{room.targetPage}</Badge>
          </div>
        </div>

        {/* Players List */}
        <div className="w-full max-w-sm">
          <p className="text-sm font-medium mb-2">Players:</p>
          <div className="space-y-2">
            {Object.values(room.players).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 p-3"
              >
                <div className="flex items-center justify-center size-7 rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{p.name}</span>
                {p.id === playerId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
                {p.id === room.hostId && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    Host
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Start Button (host only) */}
        {isHost ? (
          <Button
            size="lg"
            onClick={handleStartGame}
            disabled={starting || playerCount < 1}
            className="gap-2 px-8"
          >
            {starting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="size-4" />
                Start Game
              </>
            )}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground animate-pulse">
            Waiting for host to start the game...
          </p>
        )}
      </div>
    );
  }

  // ── Game In Progress ──────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <div className="shrink-0 p-3 border-b border-border/40 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <GameHeader
                startPage={room.startPage}
                targetPage={room.targetPage}
                currentPage={currentPage}
                startTime={room.startTime}
                steps={me?.steps ?? 0}
                finished={me?.finished ?? false}
                finishTime={me?.finishTime ?? null}
              />
            </div>

            {/* View Results (if finished) */}
            {me?.finished && (
              <Button
                onClick={() => router.push(`/room/${roomId}/results`)}
                className="gap-2 shrink-0"
              >
                <Trophy className="size-4" />
                Results
              </Button>
            )}

            {/* Toggle Sidebar (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor"/>
                <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor"/>
                <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor"/>
              </svg>
            </Button>
          </div>

          {/* Connection indicator */}
          {!connected && (
            <div className="flex items-center gap-2 text-amber-600 text-xs mt-2">
              <WifiOff className="size-3" />
              Reconnecting...
            </div>
          )}
        </div>

        {/* Article */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <ArticleRenderer
            currentPage={currentPage}
            onNavigate={handleNavigate}
            disabled={me?.finished || room.status !== "playing"}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`shrink-0 w-72 border-l border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-300 ${
          sidebarOpen
            ? "translate-x-0"
            : "translate-x-full absolute right-0 top-0 h-full z-50 lg:translate-x-0 lg:relative"
        }`}
      >
        <PlayerSidebar
          players={room.players}
          currentPlayerId={playerId}
          hostId={room.hostId}
          targetPage={room.targetPage}
          gameStatus={room.status}
        />
      </div>
    </div>
  );
}
