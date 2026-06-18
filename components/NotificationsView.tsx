"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, PageScaffold } from "@/components/ui";
import { useAuthUser } from "@/lib/auth";
import { loadNotifications, markNotificationsRead } from "@/lib/data";
import type { NotificationItem } from "@/lib/types";

function describe(n: NotificationItem): string {
  const who = n.actor ? n.actor.displayName ?? `@${n.actor.username}` : "Someone";
  if (n.type === "follow") return `${who} followed you`;
  if (n.type === "follow_request") return `${who} asked to follow you`;
  return `${who} grubbed your ${n.subjectType === "map" ? "map" : "yonder"}`;
}

function linkFor(n: NotificationItem): string | undefined {
  if (n.type === "grub" && n.subjectType === "yonder" && n.subjectId) return `/yonder/${n.subjectId}`;
  if (n.actor) return `/u/${n.actor.username}`;
  return undefined;
}

export default function NotificationsView() {
  const { user } = useAuthUser();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    let c = false;
    if (!user) {
      setItems([]);
      return;
    }
    void loadNotifications().then((n) => {
      if (c) return;
      setItems(n);
      void markNotificationsRead();
    });
    return () => {
      c = true;
    };
  }, [user]);

  return (
    <PageScaffold>
      <PageHeader title="Notifications" backHref="/you" />

      {items === null ? (
        <p className="text-sm text-[var(--muted)] py-10 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {user ? "Nothing yet, grubs and follows will show up here." : "Sign in to see your notifications."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {items.map((n) => {
            const href = linkFor(n);
            const body = (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{describe(n)}</div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">{n.when}</div>
                </div>
                {!n.read && <span className="size-2 rounded-full bg-[var(--accent)] shrink-0" />}
              </>
            );
            return (
              <li key={n.id} className="py-3">
                {href ? (
                  <Link href={href} className="flex items-center gap-3 hover:text-[var(--accent)]">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageScaffold>
  );
}
