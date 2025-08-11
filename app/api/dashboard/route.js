export async function GET(request) {
  const url = new URL(request.url);
  const days = url.searchParams.get("days");
  const date = url.searchParams.get("date");

  // your working /exec URL
  const APPSSCRIPT_URL = "https://script.google.com/macros/s/AKfycbxv-hD1QeB86DxSJuJbB59KohstB7jF8W5pbzloaAfU4vxyhSJmpO69sF0RH7ApYoA6Dw/exec";

  const qs = new URLSearchParams();
  if (days) qs.set("days", days);
  if (date) qs.set("date", date);

  try {
    const resp = await fetch(`${APPSSCRIPT_URL}${qs.toString() ? `?${qs}` : ""}`, { cache: "no-store" });
    const raw = await resp.text();
    const looksHtml = raw.trim().startsWith("<") || raw.includes("<!DOCTYPE html");
    if (!resp.ok || looksHtml) {
      return new Response(JSON.stringify({ ok:false, status:resp.status, hint: looksHtml ? "Upstream returned HTML" : "Non-200", preview: raw.slice(0,300) }),
        { status:500, headers:{ "content-type":"application/json" }});
    }
    let data; try { data = JSON.parse(raw); }
    catch { return new Response(JSON.stringify({ ok:false, error:"JSON parse failed", preview: raw.slice(0,300) }),
      { status:500, headers:{ "content-type":"application/json" }}); }
    return new Response(JSON.stringify(data), { headers:{ "content-type":"application/json", "cache-control":"no-store" }});
  } catch (err) {
    return new Response(JSON.stringify({ ok:false, error:String(err) }), { status:500, headers:{ "content-type":"application/json" }});
  }
}
