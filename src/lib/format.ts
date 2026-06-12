export const fmtMoney = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return "Rs " + v.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const fmtDate = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthISO = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
