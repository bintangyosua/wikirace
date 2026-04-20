"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStream } from "@/hooks/use-game-stream";
import { GameHeader } from "@/components/game-header";
import { ArticleRenderer } from "@/components/article-renderer";
import { ArticleSearch } from "@/components/article-search";
import { PlayerSidebar } from "@/components/player-sidebar";
import { PlayerCard } from "@/components/player-card";
import { ResultsView } from "@/components/results-view";
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
import { joinByLinkSchema } from "@/lib/validations";
import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Check,
  Play,
  Loader2,
  WifiOff,
  Trophy,
  Share2,
  ArrowRight,
  Users,
  X,
  ChevronDown,
  Flag,
  Globe,
  Shuffle,
  Home,
  Undo2,
} from "lucide-react";

interface GameViewProps {
  roomId: string;
}

export function GameView({ roomId }: GameViewProps) {
  const router = useRouter();
  const { room, connected, applyServerRoom } = useGameStream(roomId);

  const [playerId, setPlayerId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("wikirace_player_id") || "";
  });
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("wikirace_player_name") || "";
  });
  const [optimisticPage, setOptimisticPage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [goingBack, setGoingBack] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [showGiveUpDialog, setShowGiveUpDialog] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // Article selection state (for host in waiting room)
  const [useCustomPages, setUseCustomPages] = useState(false);
  const [editStartPage, setEditStartPage] = useState("");
  const [editTargetPage, setEditTargetPage] = useState("");
  // For link-join flow: user needs to enter name
  const [needsName, setNeedsName] = useState(() => {
    if (typeof window === "undefined") return false;
    return !(sessionStorage.getItem("wikirace_player_name") || "");
  });
  const [nameInput, setNameInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [nameFieldError, setNameFieldError] = useState("");

  // Auto-join room once we have room data + player info (for users who came from lobby)
  useEffect(() => {
    if (!room || !playerId || !playerName || needsName) return;

    // Store active room ID so lobby can offer "Return to Room"
    sessionStorage.setItem("wikirace_room_id", roomId);

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

  // Auto-open results when player finishes
  const roomStatus = room?.status;
  const isCurrentPlayerFinished = Boolean(
    playerId && room?.players[playerId]?.finished,
  );

  useEffect(() => {
    if (!isCurrentPlayerFinished) return;

    // Show results after a short delay when the local player finishes or gives up.
    const timer = setTimeout(() => setShowResultsModal(true), 2000);
    return () => clearTimeout(timer);
  }, [isCurrentPlayerFinished, roomStatus]);

  // Clean up player on tab close (only in waiting room, keep them if playing)
  useEffect(() => {
    if (!playerId || roomStatus !== "waiting") return;

    const handleUnload = () => {
      // Use sendBeacon for reliable delivery during page unload
      const data = JSON.stringify({ playerId });
      navigator.sendBeacon(`/api/rooms/${roomId}/leave`, data);
    };

    // 'pagehide' is more reliable than 'unload' on mobile browsers
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [playerId, roomStatus, roomId]);

  // Real-time broadcast for custom articles
  const roomHostId = room?.hostId;
  const roomStartPage = room?.startPage;
  const roomTargetPage = room?.targetPage;
  const isHostWaitingRoom = roomStatus === "waiting" && roomHostId === playerId;

  useEffect(() => {
    // Only host triggers this, and only in waiting room
    if (
      !isHostWaitingRoom ||
      !useCustomPages ||
      !editStartPage ||
      !editTargetPage
    ) {
      return;
    }

    if (editStartPage !== roomStartPage || editTargetPage !== roomTargetPage) {
      const updateRoute = setTimeout(() => {
        fetch(`/api/rooms/${roomId}/restart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            startPage: editStartPage,
            targetPage: editTargetPage,
          }),
        }).catch((err) => console.error("Auto-update route failed:", err));
      }, 300); // 300ms debounce

      return () => clearTimeout(updateRoute);
    }
  }, [
    useCustomPages,
    editStartPage,
    editTargetPage,
    roomStatus,
    roomHostId,
    roomStartPage,
    roomTargetPage,
    isHostWaitingRoom,
    playerId,
    roomId,
  ]);

  // ── Join via link: enter name and join ─────────────────────
  const handleLinkJoin = async () => {
    setNameFieldError("");
    setJoinError("");

    const result = joinByLinkSchema.safeParse({ name: nameInput });
    if (!result.success) {
      setNameFieldError(result.error.issues[0].message);
      return;
    }

    setJoining(true);

    try {
      let id = sessionStorage.getItem("wikirace_player_id");
      if (!id) {
        id = generatePlayerId();
        sessionStorage.setItem("wikirace_player_id", id);
      }
      sessionStorage.setItem("wikirace_player_name", result.data.name);

      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: id,
          playerName: result.data.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      sessionStorage.setItem("wikirace_room_id", roomId);
      setPlayerId(id);
      setPlayerName(result.data.name);
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
      const body: Record<string, string> = { playerId };

      // If host chose custom articles, restart room with new articles first
      if (
        room?.hostId === playerId &&
        useCustomPages &&
        editStartPage &&
        editTargetPage
      ) {
        await fetch(`/api/rooms/${roomId}/restart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            startPage: editStartPage,
            targetPage: editTargetPage,
          }),
        });
        // Small delay for state to propagate
        await new Promise((r) => setTimeout(r, 300));
      }

      await fetch(`/api/rooms/${roomId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setOptimisticPage(title);

      try {
        const res = await fetch(`/api/rooms/${roomId}/navigate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, page: title }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.room) {
          setOptimisticPage(null);
          return;
        }

        applyServerRoom(data.room);
      } catch (err) {
        console.error("Navigation failed:", err);
        setOptimisticPage(null);
      } finally {
        setOptimisticPage(null);
        setNavigating(false);
      }
    },
    [navigating, room, roomId, playerId, applyServerRoom],
  );

  const handleGiveUp = useCallback(async () => {
    if (givingUp || !room || room.status !== "playing") return;

    setShowGiveUpDialog(false);

    setGivingUp(true);
    try {
      await fetch(`/api/rooms/${roomId}/giveup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
    } catch (err) {
      console.error("Give up failed:", err);
    } finally {
      setGivingUp(false);
    }
  }, [givingUp, room, roomId, playerId]);

  const handleGoBack = useCallback(async () => {
    if (goingBack || navigating || !room || room.status !== "playing") return;

    const me = room.players[playerId];
    if (!me || me.finished || me.path.length <= 1) return;

    setGoingBack(true);

    // Optimistic update: go to previous page
    const prevPage = me.path[me.path.length - 2];
    setOptimisticPage(prevPage);

    try {
      const res = await fetch(`/api/rooms/${roomId}/back`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.room) {
        // Revert optimistic update
        setOptimisticPage(null);
        return;
      }

      applyServerRoom(data.room);
    } catch (err) {
      console.error("Go back failed:", err);
      setOptimisticPage(null);
    } finally {
      setOptimisticPage(null);
      setGoingBack(false);
    }
  }, [goingBack, navigating, room, roomId, playerId, applyServerRoom]);

  // ── Name Entry (join via link) ────────────────────────────
  if (!room) {
    return (
      <div className="flex items-center justify-center h-screen gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Connecting to room...</span>
      </div>
    );
  }

  if (needsName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-sm border-border/40">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Join WikiRace</CardTitle>
            <CardDescription>
              Enter your name to join room{" "}
              <span className="font-mono font-bold text-primary">{roomId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-1">
              <label htmlFor="join-name" className="text-sm font-medium">
                Your Name
              </label>
              <Input
                id="join-name"
                placeholder="Enter your name..."
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (nameFieldError) setNameFieldError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLinkJoin();
                }}
                maxLength={20}
                disabled={joining}
                autoFocus
                className={
                  nameFieldError
                    ? "border-destructive/60 focus-visible:ring-destructive/30"
                    : ""
                }
              />
              {nameFieldError && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive mt-1.5 animate-in slide-in-from-top-1 fade-in duration-200">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {nameFieldError}
                </p>
              )}
            </div>
            {joinError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="size-4 shrink-0" />
                {joinError}
              </div>
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

  const isHost = room.hostId === playerId;
  const me = room.players[playerId];
  const playerCount = Object.keys(room.players).length;
  const currentPage =
    optimisticPage && (navigating || goingBack)
      ? optimisticPage
      : (me?.currentPage ?? room.startPage);

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
          <Button variant="outline" onClick={handleShare} className="gap-2">
            <Share2 className="size-4" />
            Share Invite Link
          </Button>
        </div>

        {/* Route Preview / Article Selection (host) */}
        {isHost ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Race Route</p>
              <button
                type="button"
                onClick={() => setUseCustomPages(!useCustomPages)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {useCustomPages ? (
                  <>
                    <Shuffle className="size-3" />
                    Use current
                  </>
                ) : (
                  <>
                    <Globe className="size-3" />
                    Change articles
                  </>
                )}
              </button>
            </div>

            {useCustomPages ? (
              <div className="space-y-3 rounded-xl border border-border/40 bg-card/50 p-4">
                <ArticleSearch
                  id="wait-start-article"
                  label="Start Article"
                  placeholder="Type to search..."
                  value={editStartPage}
                  onChange={setEditStartPage}
                />
                <ArticleSearch
                  id="wait-target-article"
                  label="Target Article"
                  placeholder="Type to search..."
                  value={editTargetPage}
                  onChange={setEditTargetPage}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/40 bg-card/50">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{room.startPage}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline">{room.targetPage}</Badge>
                </div>
              </div>
            )}
          </div>
        ) : (
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
        )}

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
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem("wikirace_room_id");
                router.push("/");
              }}
              className="gap-2"
            >
              <Home className="size-4" />
              New Room
            </Button>
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
          </div>
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
    <>
      <div className="flex h-screen overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Bar */}
          <div className="shrink-0 px-2 py-1.5 sm:p-3 border-b border-border/40 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 sm:gap-3">
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

              {/* Back / Give Up / Results buttons */}
              {me?.finished ? (
                <Button
                  onClick={() => setShowResultsModal(true)}
                  size="sm"
                  variant="default"
                  className="gap-1.5 shrink-0 bg-primary/20 text-primary hover:bg-primary/30 shadow-none border border-primary/20"
                >
                  <Trophy className="size-4" />
                  <span className="hidden sm:inline">View Results</span>
                </Button>
              ) : (
                room.status === "playing" && (
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {/* Back Button */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGoBack}
                      disabled={goingBack || navigating || (me?.steps ?? 0) < 1}
                      title="Go back to previous page"
                      className="size-8 sm:size-9"
                    >
                      <Undo2 className="size-3.5 sm:size-4" />
                    </Button>

                    {/* Give Up Button */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowGiveUpDialog(true)}
                      disabled={givingUp}
                      title="Give Up"
                      className="size-8 sm:size-9 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:px-3 sm:gap-2"
                    >
                      {givingUp ? (
                        <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                      ) : (
                        <Flag className="size-3.5 sm:size-4" />
                      )}
                      <span className="hidden sm:inline text-sm">Give Up</span>
                    </Button>
                  </div>
                )
              )}

              {/* Toggle Players Panel (mobile) — big tap target */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 bg-card/60 hover:bg-card active:scale-95 transition-all min-h-11 min-w-11"
                aria-label="Toggle players panel"
              >
                <Users className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {Object.keys(room.players).length}
                </span>
                <ChevronDown
                  className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                    sidebarOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Connection indicator */}
            {!connected && (
              <div className="flex items-center gap-2 text-amber-600 text-xs mt-2">
                <WifiOff className="size-3" />
                Reconnecting...
              </div>
            )}
          </div>

          {/* Mobile Players Panel — slides down from top as overlay */}
          <div className="lg:hidden relative">
            {sidebarOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
                  onClick={() => setSidebarOpen(false)}
                  style={{ top: 0 }}
                />

                {/* Panel */}
                <div className="absolute left-0 right-0 z-50 max-h-[60vh] overflow-y-auto border-b border-border/40 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 rounded-b-2xl animate-in slide-in-from-top duration-300">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      <span className="text-sm font-semibold">Players</span>
                      <span className="text-xs text-muted-foreground">
                        ({Object.keys(room.players).length})
                      </span>
                    </div>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center justify-center size-9 rounded-lg hover:bg-muted/60 active:scale-95 transition-all"
                      aria-label="Close players panel"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Player cards */}
                  <div className="p-3 space-y-2">
                    {Object.values(room.players).map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        isCurrentUser={p.id === playerId}
                        isHost={p.id === room.hostId}
                        targetPage={room.targetPage}
                        gameStatus={room.status}
                      />
                    ))}
                  </div>
                </div>
              </>
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

        {/* Desktop Sidebar — always visible on lg+ */}
        <div className="hidden lg:block shrink-0 w-72 border-l border-border/40 bg-background/50 backdrop-blur-sm">
          <PlayerSidebar
            players={room.players}
            currentPlayerId={playerId}
            hostId={room.hostId}
            targetPage={room.targetPage}
            gameStatus={room.status}
          />
        </div>
      </div>

      {/* Give Up Confirmation Dialog */}
      <AlertDialog open={showGiveUpDialog} onOpenChange={setShowGiveUpDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Give up the race?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve taken{" "}
              <span className="font-mono font-bold text-foreground">
                {me?.steps ?? 0}{" "}
              </span>{" "}
              steps so far. Giving up means you won&apos;t be ranked among the
              finishers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Going</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGiveUp}
              className="bg-destructive/70 text-destructive-foreground hover:bg-destructive/80"
            >
              <Flag className="size-4 mr-2" />
              Give Up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results Overlay */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <ResultsView
            room={room}
            playerId={playerId}
            onClose={() => setShowResultsModal(false)}
          />
        </div>
      )}
    </>
  );
}
