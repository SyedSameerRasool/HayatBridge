// Sign in with a CNIC (national ID) instead of an email address.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  cnic: z.string().trim().regex(/^\d{5}-?\d{7}-?\d$/, "Enter a valid CNIC (13 digits)"),
  password: z.string().min(6).max(200),
});

const normalize = (v: string) => v.replace(/\D/g, "");

export const signInWithCnic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cnic = normalize(data.cnic);

    // CNIC is stored encrypted; look the account up through its keyed hash.
    const { data: cnicHash } = await supabaseAdmin.rpc("phi_hash", { _v: cnic });

    let profile: { email: string | null } | null = null;
    if (cnicHash) {
      const { data: byHash } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("cnic_hash", cnicHash)
        .maybeSingle();
      profile = byHash ?? null;
    }
    if (!profile?.email) {
      // Backward compatibility with any record not yet migrated.
      const { data: legacy } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("cnic", cnic)
        .maybeSingle();
      profile = legacy ?? null;
    }

    if (!profile?.email) throw new Error("Invalid CNIC or password.");

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signed, error } = await client.auth.signInWithPassword({
      email: profile.email,
      password: data.password,
    });
    if (error || !signed.session) throw new Error("Invalid CNIC or password.");

    return {
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    };
  });
