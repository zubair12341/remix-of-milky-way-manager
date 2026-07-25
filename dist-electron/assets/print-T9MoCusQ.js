import{a as r}from"./index-rW0WJ6BO.js";const d=`
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
</style>`;function c(t,o){const i=new Date().toLocaleString();return`<!doctype html><html><head><meta charset="utf-8"><title>${n(t.title)}</title>${d}</head>
  <body>
    <div class="header">
      ${t.logo_data_url?`<img src="${t.logo_data_url}"/>`:""}
      <div>
        <div class="shop">${n(t.shop_name||"Milk Shop")}</div>
        <div class="title">${n(t.title)}</div>
        ${t.subtitle?`<div class="sub">${n(t.subtitle)}</div>`:""}
        <div class="sub">Printed: ${i}</div>
      </div>
    </div>
    ${o}
  </body></html>`}function n(t){return String(t??"").replace(/[&<>"']/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[o])}async function m(t,o=!1){const i=r();return i.isElectron&&i.print?.html?i.print.html(t,o):new Promise(p=>{const e=document.createElement("iframe");e.style.position="fixed",e.style.right="0",e.style.bottom="0",e.style.width="0",e.style.height="0",e.style.border="0",document.body.appendChild(e);const s=e.contentDocument;s.open(),s.write(t),s.close();const a=()=>{setTimeout(()=>e.remove(),500),p({ok:!0})};e.onload=()=>{try{e.contentWindow.focus(),e.contentWindow.print()}catch{}a()},setTimeout(a,3e3)})}async function g(){const t=await r().settings.getAll();return{shop_name:t.shop_name||"Milk Shop",logo_data_url:t.logo_data_url||void 0,title:""}}export{n as e,g as l,m as p,c as w};
