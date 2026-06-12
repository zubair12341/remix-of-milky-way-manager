import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ur";

const dict = {
  en: {
    appName: "Milk Shop Manager",
    tagline: "Fast, simple shop management",
    // Auth
    signIn: "Sign In",
    signUp: "Sign Up",
    email: "Email",
    password: "Password",
    fullName: "Full Name",
    shopName: "Shop Name",
    rememberMe: "Remember me",
    createAccount: "Create Account",
    haveAccount: "Already have an account?",
    noAccount: "Don't have an account?",
    signOut: "Sign Out",
    // Nav
    dashboard: "Dashboard",
    cashCounter: "Cash Counter",
    udhar: "Udhar",
    monthlyClients: "Monthly Clients",
    reports: "Reports",
    settings: "Settings",
    // Common
    save: "Save",
    cancel: "Cancel",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    search: "Search",
    print: "Print",
    date: "Date",
    amount: "Amount",
    notes: "Notes",
    name: "Name",
    mobile: "Mobile",
    address: "Address",
    total: "Total",
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    thisMonth: "This Month",
    back: "Back",
    loading: "Loading...",
    noData: "No data yet",
    // Dashboard
    welcomeBack: "Welcome back",
    todaySales: "Today's Sales",
    todayCash: "Today's Cash",
    outstandingUdhar: "Outstanding Udhar",
    activeMonthlyClients: "Monthly Clients",
    // Cash counter
    newSale: "New Sale",
    enterAmount: "Enter Amount",
    pressEnter: "Press Enter to save",
    saved: "Saved!",
    slipNo: "Slip #",
    operator: "Operator",
    printInvoice: "Print Invoice",
    recentSales: "Recent Sales",
    invoice: "Invoice",
    thankYou: "Thank you for your business!",
    // Udhar
    addCustomer: "Add Customer",
    addCredit: "Add Credit",
    receivePayment: "Receive Payment",
    customer: "Customer",
    credit: "Credit",
    payment: "Payment",
    balance: "Balance",
    totalCredit: "Total Credit",
    totalReceived: "Total Received",
    remaining: "Remaining",
    viewLedger: "View Ledger",
    ledger: "Ledger",
    // Monthly
    addClient: "Add Client",
    dailyQuantity: "Daily Quantity (L)",
    milkType: "Milk Type",
    ratePerLiter: "Rate per Liter",
    monthlyBill: "Monthly Bill",
    billingMonth: "Billing Month",
    paid: "Paid",
    unpaid: "Unpaid",
    partial: "Partial",
    generateBill: "Generate Bill",
    markPaid: "Mark Paid",
    cow: "Cow",
    buffalo: "Buffalo",
    mixed: "Mixed",
    // Reports
    dailyReport: "Daily Report",
    weeklyReport: "Weekly Report",
    monthlyReport: "Monthly Report",
    cashSales: "Cash Sales",
    udharSales: "Udhar Sales",
    collections: "Collections",
    netAmount: "Net Amount",
    // Settings
    shopInformation: "Shop Information",
    shopAddress: "Shop Address",
    shopPhone: "Shop Phone",
    shopLogo: "Shop Logo URL",
    language: "Language",
    english: "English",
    urdu: "اردو",
    profile: "Profile",
    appearance: "Appearance",
    darkMode: "Dark Mode",
  },
  ur: {
    appName: "ملک شاپ منیجر",
    tagline: "تیز، آسان دکان مینجمنٹ",
    signIn: "لاگ ان",
    signUp: "اکاؤنٹ بنائیں",
    email: "ای میل",
    password: "پاس ورڈ",
    fullName: "پورا نام",
    shopName: "دکان کا نام",
    rememberMe: "مجھے یاد رکھیں",
    createAccount: "اکاؤنٹ بنائیں",
    haveAccount: "پہلے سے اکاؤنٹ ہے؟",
    noAccount: "اکاؤنٹ نہیں ہے؟",
    signOut: "لاگ آؤٹ",
    dashboard: "ڈیش بورڈ",
    cashCounter: "کیش کاؤنٹر",
    udhar: "ادھار",
    monthlyClients: "ماہانہ گاہک",
    reports: "رپورٹس",
    settings: "سیٹنگز",
    save: "محفوظ کریں",
    cancel: "منسوخ",
    add: "شامل کریں",
    edit: "ترمیم",
    delete: "حذف",
    search: "تلاش",
    print: "پرنٹ",
    date: "تاریخ",
    amount: "رقم",
    notes: "نوٹس",
    name: "نام",
    mobile: "موبائل",
    address: "پتہ",
    total: "کل",
    today: "آج",
    yesterday: "کل",
    thisWeek: "اس ہفتے",
    thisMonth: "اس ماہ",
    back: "واپس",
    loading: "لوڈ ہو رہا ہے...",
    noData: "کوئی ڈیٹا نہیں",
    welcomeBack: "خوش آمدید",
    todaySales: "آج کی فروخت",
    todayCash: "آج کی نقدی",
    outstandingUdhar: "بقایا ادھار",
    activeMonthlyClients: "ماہانہ گاہک",
    newSale: "نئی فروخت",
    enterAmount: "رقم درج کریں",
    pressEnter: "محفوظ کرنے کے لیے Enter دبائیں",
    saved: "محفوظ ہو گیا!",
    slipNo: "سلپ #",
    operator: "آپریٹر",
    printInvoice: "رسید پرنٹ کریں",
    recentSales: "حالیہ فروخت",
    invoice: "رسید",
    thankYou: "آپ کا شکریہ!",
    addCustomer: "گاہک شامل کریں",
    addCredit: "ادھار شامل کریں",
    receivePayment: "ادائیگی وصول کریں",
    customer: "گاہک",
    credit: "ادھار",
    payment: "ادائیگی",
    balance: "بیلنس",
    totalCredit: "کل ادھار",
    totalReceived: "کل وصول",
    remaining: "باقی",
    viewLedger: "کھاتہ دیکھیں",
    ledger: "کھاتہ",
    addClient: "گاہک شامل کریں",
    dailyQuantity: "روزانہ مقدار (لیٹر)",
    milkType: "دودھ کی قسم",
    ratePerLiter: "فی لیٹر ریٹ",
    monthlyBill: "ماہانہ بل",
    billingMonth: "بلنگ ماہ",
    paid: "ادا شدہ",
    unpaid: "غیر ادا شدہ",
    partial: "جزوی",
    generateBill: "بل بنائیں",
    markPaid: "ادا شدہ نشان زد کریں",
    cow: "گائے",
    buffalo: "بھینس",
    mixed: "مکس",
    dailyReport: "روزانہ رپورٹ",
    weeklyReport: "ہفتہ وار رپورٹ",
    monthlyReport: "ماہانہ رپورٹ",
    cashSales: "نقد فروخت",
    udharSales: "ادھار فروخت",
    collections: "وصولیاں",
    netAmount: "خالص رقم",
    shopInformation: "دکان کی معلومات",
    shopAddress: "دکان کا پتہ",
    shopPhone: "دکان کا فون",
    shopLogo: "دکان کا لوگو URL",
    language: "زبان",
    english: "English",
    urdu: "اردو",
    profile: "پروفائل",
    appearance: "ظاہری شکل",
    darkMode: "ڈارک موڈ",
  },
} as const;

export type TKey = keyof typeof dict.en;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  dir: "ltr" | "rtl";
};
const LangCtx = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang) : null;
    if (saved === "ur" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: TKey) => dict[lang][k] ?? dict.en[k] ?? k;
  const dir = lang === "ur" ? "rtl" : "ltr";

  return <LangCtx.Provider value={{ lang, setLang, t, dir }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
