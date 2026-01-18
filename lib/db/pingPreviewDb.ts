const previewUrl = "https://preview.meadtools.com";

const breadcalcSupabaseUrl = process.env.BREADCALC_SUPABASE_URL;
const breadcalcSupabaseAnonKey = process.env.BREADCALC_SUPABASE_ANON_KEY;

export const pingPreview = () => {
  // MeadTools preview ping (ok to keep t= here)
  fetch(`${previewUrl}/api/ingredients?keepalive=1&t=${Date.now()}`, {
    method: "GET",
    cache: "no-store"
  })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      console.log("pingPreview (meadtools) response:", {
        ok: res.ok,
        status: res.status,
        body: text
      });
    })
    .catch((error) => {
      console.error("pingPreview (meadtools) failed:", error);
    });

  // Breadcalc Supabase REST ping (NO extra query params)
  if (!breadcalcSupabaseUrl || !breadcalcSupabaseAnonKey) {
    console.warn(
      "pingPreview (breadcalc) skipped: missing BREADCALC_SUPABASE_URL or ANON_KEY"
    );
    return;
  }

  const breadcalcUrl = `${breadcalcSupabaseUrl}/rest/v1/ingredients?select=id&limit=1`;

  fetch(breadcalcUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: breadcalcSupabaseAnonKey,
      authorization: `Bearer ${breadcalcSupabaseAnonKey}`,
      accept: "application/json",
      // optional cache-bust marker that won't affect PostgREST parsing
      "x-ping": String(Date.now())
    }
  })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      console.log("pingPreview (breadcalc) response:", {
        ok: res.ok,
        status: res.status,
        body: text
      });
    })
    .catch((error) => {
      console.error("pingPreview (breadcalc) failed:", error);
    });
};
