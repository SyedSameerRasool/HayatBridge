import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit.functions";

const IDLE_MS = 15 * 60 * 1000; // sign out after 15 minutes of inactivity
const WARN_MS = 60 * 1000; // warn one minute before

/**
 * App-wide secure session management: refreshes tokens in the background,
 * warns before expiry and signs the user out after prolonged inactivity.
 * Purely behavioural — renders nothing and changes no UI.
 */
export function SessionGuard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signedIn = useRef(false);

  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    let warn: ReturnType<typeof setTimeout>;
    let disposed = false;

    const clear = () => {
      clearTimeout(idle);
      clearTimeout(warn);
    };

    const endSession = async () => {
      if (!signedIn.current) return;
      signedIn.current = false;
      clear();
      try {
        await logAuditEvent({ data: { action: "SESSION_TIMEOUT", table_name: "auth" } });
      } catch {
        /* logging must never block sign-out */
      }
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.info("Signed out after 15 minutes of inactivity.");
      navigate({ to: "/auth", replace: true });
    };

    const arm = () => {
      clear();
      if (!signedIn.current || disposed) return;
      warn = setTimeout(
        () => toast.warning("You will be signed out in 1 minute due to inactivity."),
        IDLE_MS - WARN_MS,
      );
      idle = setTimeout(() => void endSession(), IDLE_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "focus"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));

    supabase.auth.getSession().then(({ data }) => {
      signedIn.current = !!data.session;
      arm();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      signedIn.current = !!session;
      if (event === "SIGNED_OUT") clear();
      else arm();
    });

    return () => {
      disposed = true;
      clear();
      events.forEach((e) => window.removeEventListener(e, arm));
      sub.subscription.unsubscribe();
    };
  }, [navigate, qc]);

  return null;
}
