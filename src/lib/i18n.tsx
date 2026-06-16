import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ur";

const dict = {
  en: {
    appName: "Milk Shop Manager",
    tagline: "Fast, simple shop management",
    // Auth
    signIn: "Sign In",
    signOut: "Sign Out",
    username: "Username",
    password: "Password",
    defaultCreds: "Default",
    loggedInAs: "Logged in as",
    currentPassword: "Current Password",
    newUsername: "New Username",
    newPassword: "New Password",
    security: "Security",
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
    back: "Back",
    loading: "Loading...",
    noData: "No data yet",
    saved: "Saved",
    invalidAmount: "Enter a valid amount",
    // Dashboard
    welcomeBack: "Welcome",
    todayCash: "Today's Cash",
    outstandingUdhar: "Outstanding Udhar",
    // Cash counter
    enterAmount: "Enter Amount",
    pressEnter: "Press Enter to save",
    pressEnterToPrint: "Press Enter to save & print",
    lastInvoice: "Last Invoice",
    recentSales: "Recent Sales",
    // Udhar
    addCustomer: "Add Customer",
    deleteCustomer: "Delete Customer",
    addCredit: "Add Credit",
    receivePayment: "Receive Payment",
    credit: "Credit",
    payment: "Payment",
    balance: "Balance",
    totalCredit: "Total Credit",
    totalReceived: "Total Received",
    ledger: "Ledger",
    // Monthly
    addClient: "Add Client",
    dailyQuantity: "Daily Quantity (L)",
    milkType: "Milk Type",
    ratePerLiter: "Rate per Liter",
    monthlyBill: "Monthly Bill",
    cow: "Cow",
    buffalo: "Buffalo",
    mixed: "Mixed",
    recordPayment: "Record Payment",
    paymentHistory: "Payment History",
    paidThisMonth: "Paid This Month",
    pending: "Pending",
    period: "Period",
    // Reports
    cashSales: "Cash Sales",
    last14Days: "Last 14 days",
    exportCsv: "Export CSV",
    // Settings
    shopInformation: "Shop Information",
    shopName: "Shop Name",
    shopLogo: "Shop Logo",
    language: "Language",
    printerSettings: "Printer Settings",
    selectPrinter: "Select Printer",
    systemDefault: "System Default",
    receiptWidth: "Receipt Width",
    testPrint: "Test Print",
    dataManagement: "Data Management",
    backupDb: "Backup Database",
    restoreDb: "Restore Database",
    dangerZone: "Danger Zone",
    clearAllData: "Clear All Data",
    clearWarning: "Are you sure? This will delete all sales, udhar, and monthly clients. This action cannot be undone.",
    desktopOnly: "Available in desktop build only",
    // Purchases
    purchases: "Purchases",
    addSupplier: "Add Supplier",
    deleteSupplier: "Delete Supplier",
    addPurchase: "Add Purchase",
    payToSupplier: "Pay Supplier",
    purchase: "Purchase",
    quantityL: "Quantity (L)",
    paidNow: "Paid Now",
    totalPaid: "Total Paid",
    totalPurchase: "Total Purchase",
    todayPurchase: "Today's Purchase",
    monthPurchase: "This Month",
    owedToSuppliers: "Owed to Suppliers",
    balanceOwed: "Balance Owed",
    profit: "Profit",
    profitLast14: "Profit (sales − purchases)",
  },
  ur: {
    appName: "ملک شاپ منیجر",
    tagline: "تیز، آسان دکان مینجمنٹ",
    signIn: "لاگ ان",
    signOut: "لاگ آؤٹ",
    username: "صارف نام",
    password: "پاس ورڈ",
    defaultCreds: "ڈیفالٹ",
    loggedInAs: "لاگ ان",
    currentPassword: "موجودہ پاس ورڈ",
    newUsername: "نیا صارف نام",
    newPassword: "نیا پاس ورڈ",
    security: "سیکیورٹی",
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
    back: "واپس",
    loading: "لوڈ ہو رہا ہے...",
    noData: "کوئی ڈیٹا نہیں",
    saved: "محفوظ ہو گیا",
    invalidAmount: "درست رقم درج کریں",
    welcomeBack: "خوش آمدید",
    todayCash: "آج کی نقدی",
    outstandingUdhar: "بقایا ادھار",
    enterAmount: "رقم درج کریں",
    pressEnter: "محفوظ کرنے کے لیے Enter دبائیں",
    pressEnterToPrint: "محفوظ اور پرنٹ کے لیے Enter دبائیں",
    lastInvoice: "آخری رسید",
    recentSales: "حالیہ فروخت",
    addCustomer: "گاہک شامل کریں",
    deleteCustomer: "گاہک حذف کریں",
    addCredit: "ادھار شامل کریں",
    receivePayment: "ادائیگی وصول کریں",
    credit: "ادھار",
    payment: "ادائیگی",
    balance: "بیلنس",
    totalCredit: "کل ادھار",
    totalReceived: "کل وصول",
    ledger: "کھاتہ",
    addClient: "گاہک شامل کریں",
    dailyQuantity: "روزانہ مقدار (لیٹر)",
    milkType: "دودھ کی قسم",
    ratePerLiter: "فی لیٹر ریٹ",
    monthlyBill: "ماہانہ بل",
    cow: "گائے",
    buffalo: "بھینس",
    mixed: "مکس",
    cashSales: "نقد فروخت",
    last14Days: "پچھلے 14 دن",
    exportCsv: "CSV ایکسپورٹ",
    shopInformation: "دکان کی معلومات",
    shopName: "دکان کا نام",
    shopLogo: "دکان کا لوگو",
    language: "زبان",
    printerSettings: "پرنٹر سیٹنگز",
    selectPrinter: "پرنٹر منتخب کریں",
    systemDefault: "سسٹم ڈیفالٹ",
    receiptWidth: "رسید کی چوڑائی",
    testPrint: "ٹیسٹ پرنٹ",
    dataManagement: "ڈیٹا مینجمنٹ",
    backupDb: "بیک اپ ڈیٹابیس",
    restoreDb: "بحال کریں",
    dangerZone: "خطرناک علاقہ",
    clearAllData: "تمام ڈیٹا صاف کریں",
    clearWarning: "کیا آپ یقین رکھتے ہیں؟ تمام ڈیٹا حذف ہو جائے گا۔ یہ عمل واپس نہیں ہو سکتا۔",
    desktopOnly: "صرف ڈیسک ٹاپ ایپ میں دستیاب",
    purchases: "خریداری",
    addSupplier: "سپلائر شامل کریں",
    deleteSupplier: "سپلائر حذف کریں",
    addPurchase: "خریداری شامل کریں",
    payToSupplier: "سپلائر کو ادائیگی",
    purchase: "خریداری",
    quantityL: "مقدار (لیٹر)",
    paidNow: "ابھی ادا کیا",
    totalPaid: "کل ادائیگی",
    totalPurchase: "کل خریداری",
    todayPurchase: "آج کی خریداری",
    monthPurchase: "اس ماہ",
    owedToSuppliers: "سپلائرز کا واجب الادا",
    balanceOwed: "واجب الادا بیلنس",
    profit: "منافع",
    profitLast14: "منافع (فروخت − خریداری)",
  },
} as const;

export type TKey = keyof typeof dict.en;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; dir: "ltr" | "rtl" };
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

  const t = (k: TKey) => (dict[lang] as any)[k] ?? (dict.en as any)[k] ?? k;
  const dir = lang === "ur" ? "rtl" : "ltr";

  return <LangCtx.Provider value={{ lang, setLang, t, dir }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
