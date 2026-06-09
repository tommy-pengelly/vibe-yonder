"use client";

// Last-resort boundary: catches errors in the root layout itself (which the
// per-segment error.tsx can't). Replaces the whole document, so it ships its
// own <html>/<body> and inline styles.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#0a0b0d",
          color: "#ededed",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "0 20px",
        }}
      >
        <p style={{ fontSize: 22 }}>Something went sideways</p>
        <p style={{ fontSize: 14, color: "#7d7a76", maxWidth: 320 }}>
          The app hit a snag loading. Reload to try again.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: 9999,
              background: "#f5a623",
              color: "#000",
              fontWeight: 600,
              border: "none",
              padding: "8px 16px",
              fontSize: 14,
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            style={{
              borderRadius: 9999,
              border: "1px solid #1a1c1f",
              background: "transparent",
              color: "#ededed",
              padding: "8px 16px",
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
