// Shared print helpers. Uses Electron silent print when available, else window.print fallback.
import { api } from "@/lib/db";

export type PrintMeta = { shop_name: string; logo_data_url?: string; title: string; subtitle?: string };

const baseStyles = `
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #000; margin: 0; font-size: 11pt; }
  h1, h2, h3 { margin: 0 0 4px; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
  .header img { max-height: 60px; max-width: 80px; object-fit: contain; }
  .shop { font-size: 18pt; font-weight: 800; }
  .title { font-size: 14pt; font-weight: 700; margin-top: 12px; }
  .sub { font-size: 10pt; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  th { background: #f3f3f3; font-weight: 700; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 800; border-top: 2px solid #000; }
  .totals { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px; }
  .box { border: 1px solid #ccc; border-radius: 6px; padding: 10px; }
  .box .l { font-size: 9pt; color: #666; text-transform: uppercase; }
  .box .v { font-size: 14pt; font-weight: 800; }
  .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .section { margin-top: 18px; }
  .section h3 { font-size: 12pt; border-bottom: 1px solid #999; padding-bottom: 4px; margin-bottom: 6px; }
  @media print { .no-print { display: none; } }
</style>`;

export function wrapDocument(meta: PrintMeta, body: string) {
  const date = new Date().toLocaleString();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(meta.title)}</title>${baseStyles}</head>
  <body>
    <div class="header">
      ${meta.logo_data_url ? `<img src="${meta.logo_data_url}"/>` : ""}
      <div>
        <div class="shop">${escape(meta.shop_name || "Milk Shop")}</div>
        <div class="title">${escape(meta.title)}</div>
        ${meta.subtitle ? `<div class="sub">${escape(meta.subtitle)}</div>` : ""}
        <div class="sub">Printed: ${date}</div>
      </div>
    </div>
    ${body}
  </body></html>`;
}

export function escape(s: any) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
}

export async function printDocument(html: string, thermal = false) {
  const a = api();
  if (a.isElectron && a.print?.html) {
    // Desktop app: fully silent, straight to configured printer.
    return a.print.html(html, thermal);
  }
  // Browser preview fallback: hidden iframe (no popup window). The browser
  // will still show its native print dialog — this is a browser limitation.
  // In the packaged Windows app this code path is never used.
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    const cleanup = () => { setTimeout(() => iframe.remove(), 500); resolve({ ok: true }); };
    iframe.onload = () => {
      try { iframe.contentWindow!.focus(); iframe.contentWindow!.print(); } catch {}
      cleanup();
    };
    setTimeout(cleanup, 3000);
  });
}

export async function loadShopMeta(): Promise<PrintMeta> {
  const s = await api().settings.getAll();
  return { shop_name: s.shop_name || "Milk Shop", logo_data_url: s.logo_data_url || undefined, title: "" };
}
