import Link from "next/link";

export const metadata = {
  title: "How Vibe Yonder works",
};

export default function ExplainPage() {
  return (
    <div className="flex-1 w-full max-w-md mx-auto px-5 pt-10 pb-16">
      <Link
        href="/"
        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← Back
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight mt-6">
        How Vibe Yonder works
      </h1>

      <p className="mt-4 text-[var(--foreground)] leading-relaxed">
        Vibe Yonder doesn&apos;t give you a route. It shows an arrow pointing
        straight at your destination — as the crow flies — and lets you choose
        your own streets. Wander, detour, double back. Getting there the long
        way is the whole idea.
      </p>

      <h2 className="text-lg font-semibold mt-8">Your stats, explained</h2>

      <dl className="mt-3 flex flex-col gap-4 text-[var(--foreground)]">
        <Row term="Walked">
          The total distance you actually covered on foot.
        </Row>
        <Row term="Time">
          How long you were out (paused time doesn&apos;t count).
        </Row>
        <Row term="Direct">
          The straight-line distance from where you started to where you
          finished, ignoring streets and detours. This is what &quot;as the
          crow flies&quot; means.
        </Row>
        <Row term="Yondered">
          How many times <em>further</em> you walked than that straight line:{" "}
          <span className="font-mono text-[var(--accent)]">
            Walked ÷ Direct
          </span>
          . A beeline is <strong>1×</strong>; the more you loop and detour, the
          higher it climbs. Walks that loop back near where you began send it
          sky-high — which, for an exploring app, is a badge of honour.
        </Row>
        <Row term="Pace">Your average minutes per kilometre.</Row>
      </dl>

      <p className="text-sm text-[var(--muted)] mt-10">
        Geocoding is provided by{" "}
        <a
          href="https://nominatim.openstreetmap.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Nominatim
        </a>{" "}
        / OpenStreetMap. We don&apos;t store your walks anywhere — everything
        lives in your browser tab.
      </p>
    </div>
  );
}

function Row({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-[var(--accent)]">
        {term}
      </dt>
      <dd className="mt-1 text-[var(--foreground)] leading-relaxed">
        {children}
      </dd>
    </div>
  );
}
