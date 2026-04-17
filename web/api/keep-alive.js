import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const secret = process.env.KEEP_ALIVE_SECRET;

  if (!secret) {
    return res
      .status(500)
      .json({ error: "KEEP_ALIVE_SECRET is not configured on the server" });
  }

  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await supabase
    .from("keep_alive")
    .update({ last_updated: new Date().toISOString() })
    .eq("id", 1)
    .select("last_updated")
    .single();

  if (error) {
    return res
      .status(500)
      .json({ error: "Database update failed", detail: error.message });
  }

  if (!data) {
    return res.status(404).json({
      error: "Keep-alive row not found",
      hint: "Run the seed SQL: INSERT INTO keep_alive (id) VALUES (1);",
    });
  }

  return res.status(200).json({ ok: true, updated_at: data.last_updated });
}
