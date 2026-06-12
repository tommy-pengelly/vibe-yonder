"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_PLAN, loadPlanConfig, type PlanConfig } from "@/lib/data";
import YonderPlusSheet from "./YonderPlusSheet";

// Owns the Yonder+ sheet + the live plan config (which features are gated, the
// meter limits). Any feature site reads this via useGate / useMeter.
type PaywallCtx = { requirePlus: (reason?: string) => void; config: PlanConfig };
const Ctx = createContext<PaywallCtx>({ requirePlus: () => {}, config: DEFAULT_PLAN });

export const usePaywall = () => useContext(Ctx);

export default function PaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [config, setConfig] = useState<PlanConfig>(DEFAULT_PLAN);

  useEffect(() => {
    void loadPlanConfig().then(setConfig);
  }, []);

  const requirePlus = (r?: string) => {
    setReason(r);
    setOpen(true);
  };
  return (
    <Ctx.Provider value={{ requirePlus, config }}>
      {children}
      <YonderPlusSheet open={open} onClose={() => setOpen(false)} reason={reason} />
    </Ctx.Provider>
  );
}
