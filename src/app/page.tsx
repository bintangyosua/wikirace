import { LobbyForm } from "@/components/lobby-form";

export default function LobbyPage() {
  return (
    <main className="flex flex-col items-center min-h-screen py-16 px-6">
      {/* Hero */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Multiplayer Wikipedia Racing
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Wiki<span className="text-primary">Race</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Race from one Wikipedia article to another using only internal links.
          Fewest steps wins!
        </p>
      </div>

      {/* Form */}
      <LobbyForm />

      {/* Footer */}
      <footer className="mt-auto pt-12 text-center text-xs text-muted-foreground">
        <p>
          WikiRace uses the{" "}
          <a
            href="https://www.mediawiki.org/wiki/API:Main_page"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Wikipedia API
          </a>{" "}
          — content is available under CC BY-SA 3.0
        </p>
      </footer>
    </main>
  );
}
