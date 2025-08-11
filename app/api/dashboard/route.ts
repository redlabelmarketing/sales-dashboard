const UPSTREAM =
  "https://script.google.com/macros/s/AKfycbxv-hD1QeB86DxSJuJbB59KohstB7jF8W5pbzloaAfU4vxyhSJmpO69sF0RH7ApYoA6Dw/exec";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days");
  const date = searchParams.get("date");
  const diag = searchParams.get("diag");

  const qs = new URLSearchParams();
  if (days) qs.set("days", days);
  if (date) qs.set("date", date);
  if (diag) qs.set("diag", diag);

  const url = `${UPSTREAM}${qs.toString() ? "?" + qs.toString() : ""}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    try {
      const json = JSON.parse(text);
      return new Response(JSON.stringify(json), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          status: res.status,
          hint: "Upstream returned non-JSON (is your URL the /exec endpoint and set to Anyone?)",
          preview: text.slice(0, 400),
        }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
