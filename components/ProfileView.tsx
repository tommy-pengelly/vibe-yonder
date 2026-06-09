"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { useAuthUser } from "@/lib/auth";
import {
  follow,
  followCounts,
  followState,
  getProfileByUsername,
  loadUserShared,
  unfollow,
  updateProfile,
} from "@/lib/data";
import { fmtDist } from "@/lib/geo";
import type { FeedYonder, FollowCounts, Profile } from "@/lib/types";

function fmtYondered(v: number): string {
  return v >= 10 ? Math.round(v).toString() : v.toFixed(v >= 2 ? 1 : 2);
}

export default function ProfileView({ username }: { username: string }) {
  const { user } = useAuthUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [fstate, setFstate] = useState<"none" | "pending" | "accepted">("none");
  const [shared, setShared] = useState<FeedYonder[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const isMe = !!(user && profile && user.id === profile.id);

  useEffect(() => {
    let c = false;
    void getProfileByUsername(username).then(async (p) => {
      if (c) return;
      setProfile(p);
      setLoaded(true);
      if (!p) return;
      void followCounts(p.id).then((cc) => !c && setCounts(cc));
      void loadUserShared(p.id).then((s) => !c && setShared(s));
      void followState(p.id).then((f) => !c && setFstate(f));
    });
    return () => {
      c = true;
    };
  }, [username, user]);

  if (!profile) {
    if (!loaded) return <div className="flex-1" />;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3">
        <p className="text-sm text-[var(--muted)]">No explorer at @{username}.</p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:opacity-80">Back to Feed</Link>
      </div>
    );
  }

  const toggleFollow = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (fstate === "none") {
      const target = profile.isPrivate ? "pending" : "accepted";
      setFstate(target);
      if (target === "accepted") setCounts((c) => ({ ...c, followers: c.followers + 1 }));
      await follow(profile.id);
    } else {
      const wasAccepted = fstate === "accepted";
      setFstate("none");
      if (wasAccepted) setCounts((c) => ({ ...c, followers: c.followers - 1 }));
      await unfollow(profile.id);
    }
  };

  const followLabel =
    fstate === "accepted" ? "Following" : fstate === "pending" ? "Requested" : profile.isPrivate ? "Request" : "Follow";
  const lockedPrivate = profile.isPrivate && fstate !== "accepted" && !isMe;

  const stats = {
    places: shared.reduce((s, y) => s + y.places, 0),
    walked: shared.reduce((s, y) => s + y.walked, 0),
    avg: shared.length ? shared.reduce((s, y) => s + y.yondered, 0) / shared.length : 0,
  };

  return (
    <>
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6">
        <Link href="/" aria-label="Back" className="size-9 -ml-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </Link>

        <header className="flex items-start gap-4">
          <div className="size-16 shrink-0 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-display text-2xl text-[var(--warm)]">
            {(profile.displayName ?? profile.username).replace(/[@.]/g, "").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl tracking-tight leading-tight truncate">
              {profile.displayName ?? `@${profile.username}`}
            </h1>
            <div className="text-sm text-[var(--muted)]">@{profile.username}</div>
            <div className="text-xs text-[var(--muted)] mt-1 font-mono tabular-nums flex gap-3">
              <Link href={`/u/${profile.username}/followers`} className="hover:text-[var(--accent)]">
                {counts.followers} followers
              </Link>
              <Link href={`/u/${profile.username}/following`} className="hover:text-[var(--accent)]">
                {counts.following} following
              </Link>
            </div>
          </div>
        </header>

        {profile.bio && <p className="text-sm leading-relaxed text-[var(--warm)] -mt-2">{profile.bio}</p>}

        {isMe ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start rounded-full border border-[var(--border)] text-sm px-4 py-2 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Edit profile
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void toggleFollow()}
            className={`self-start rounded-full text-sm font-semibold px-5 py-2 ${
              fstate !== "none"
                ? "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                : "bg-[var(--accent)] text-black active:opacity-80"
            }`}
          >
            {followLabel}
          </button>
        )}

        <div className="grid grid-cols-3 gap-3 text-center font-mono tabular-nums">
          <Stat label="Places seen" value={`${stats.places}`} />
          <Stat label="Wandered" value={fmtDist(stats.walked)} />
          <Stat label="Avg" value={`${fmtYondered(stats.avg)}×`} />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Shared yonders</h2>
          {lockedPrivate ? (
            <p className="text-sm text-[var(--muted)]">
              This account is private. Follow {profile.displayName ?? `@${profile.username}`} to see their wanders.
            </p>
          ) : shared.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing shared yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {shared.map((y) => (
                <li key={y.id}>
                  <Link href={`/yonder/${y.id}`} className="flex items-center gap-3 py-3 hover:text-[var(--accent)]">
                    <Thumb points={y.trace} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base truncate">{y.caption ?? y.area}</div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">{y.when} · {fmtDist(y.walked)}</div>
                    </div>
                    <div className="text-sm font-mono text-[var(--accent)] tabular-nums shrink-0">
                      {fmtYondered(y.yondered)}×
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <AuthModal open={authOpen} reason="Sign in to follow explorers." onClose={() => setAuthOpen(false)} />
      {editing && (
        <EditProfile
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setProfile(p);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function EditProfile({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const res = await updateProfile({ username, displayName, bio, isPrivate });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "Could not save.");
      return;
    }
    onSaved({
      ...profile,
      username: username.trim().toLowerCase(),
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      isPrivate,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full bg-[var(--surface)] border-t border-[var(--border)] rounded-t-2xl px-5 pt-5 pb-8 flex flex-col gap-3">
        <h2 className="font-display text-xl">Edit profile</h2>
        <Field label="Username" prefix="@" value={username} onChange={setUsername} />
        <Field label="Display name" value={displayName} onChange={setDisplayName} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2}
            className="w-full resize-none rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => setIsPrivate((v) => !v)}
          className="flex items-center gap-3 text-left rounded-xl border border-[var(--border)] px-3 py-2.5 hover:border-[var(--muted)]"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Private account</div>
            <div className="text-xs text-[var(--muted)]">New followers need your approval; only they see your yonders.</div>
          </div>
          <div className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${isPrivate ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}>
            <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-[var(--foreground)] transition-transform ${isPrivate ? "translate-x-4" : "translate-x-0"}`} />
          </div>
        </button>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button type="button" onClick={() => void save()} disabled={busy}
          className="rounded-full bg-[var(--accent)] text-black font-semibold py-3 active:opacity-80 disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, prefix }: { label: string; value: string; onChange: (v: string) => void; prefix?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</span>
      <div className="flex items-center rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 focus-within:border-[var(--accent)]">
        {prefix && <span className="text-[var(--muted)]">{prefix}</span>}
        <input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent py-2 text-sm outline-none" />
      </div>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] py-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-sans">{label}</div>
      <div className="text-lg mt-0.5">{value}</div>
    </div>
  );
}

function Thumb({ points }: { points: number[][] }) {
  const d = points.length > 1 ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") : "";
  return (
    <div className="size-12 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 overflow-hidden">
      {d && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}
