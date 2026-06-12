"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import YonderPlusSheet from "./YonderPlusSheet";

// One place that owns the Yonder+ sheet. Any feature site calls requirePlus()
// (via useGate / useMeter) to open it with the right reason.
type PaywallCtx = { requirePlus: (reason?: string) => void };
const Ctx = createContext<PaywallCtx>({ requirePlus: () => {} });

export const usePaywall = () => useContext(Ctx);

export default function PaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const requirePlus = (r?: string) => {
    setReason(r);
    setOpen(true);
  };
  return (
    <Ctx.Provider value={{ requirePlus }}>
      {children}
      <YonderPlusSheet open={open} onClose={() => setOpen(false)} reason={reason} />
    </Ctx.Provider>
  );
}
