import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Beer, LogOut, Plus, Minus, X, Receipt, TrendingUp, Package, IndianRupee, Clock, ChevronRight, Check, AlertTriangle, BarChart3, Users, Settings, Trash2, Edit3, Wifi, WifiOff, Lock } from "lucide-react";
import { cloudGet, cloudSet } from "./storage.js";

// ---------- Seed data (used only the very first time cloud storage is empty) ----------
const STAFF = [
  { id: "s1", name: "Rohan", pin: "1111" },
  { id: "s2", name: "Priya", pin: "2222" },
  { id: "s3", name: "Vikram", pin: "3333" },
];

const DEFAULT_CATEGORIES = ["Beer", "Snacks"];

const DEFAULT_MENU = [
  { id: "m1", name: "Peoples", category: "Beer", price: 150, stock: 42, unit: "bottle" },
  { id: "m2", name: "Maka", category: "Beer", price: 160, stock: 24, unit: "bottle" },
  { id: "m3", name: "Kingfisher Strong", category: "Beer", price: 140, stock: 30, unit: "bottle" },
  { id: "m4", name: "Salted Peanuts", category: "Snacks", price: 90,  stock: 15, unit: "plate" },
];

const ROOMS = ["Dorm 3 - Bed 4", "Dorm 3 - Bed 7", "Pvt Room 2", "Dorm 1 - Bed 1", "Pvt Room 5"];

// ---------- Cloud storage tables (one row per table — one bar, any device) ----------
const TABLE_MENU = "menu";
const TABLE_TABS = "tabs";
const TABLE_HISTORY = "history";
const SYNC_INTERVAL_MS = 4000;

// ---------- Helpers ----------
const inr = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const now = () => new Date();
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const uid = () => Math.random().toString(36).slice(2, 9);

// ---------- Root ----------
export default function App() {
  const [booting, setBooting] = useState(true);
  const [staff, setStaff] = useState(null);
  const [shift, setShift] = useState(null);
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [tabs, setTabs] = useState([]);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("floor");
  const [activeTabId, setActiveTabId] = useState(null);
  const [toast, setToast] = useState(null);
  const [syncState, setSyncState] = useState("ok"); // ok | syncing | error
  const lastSyncRef = useRef(0);

  const showToast = useCallback((msg, kind = "ok") => setToast({ msg, kind, key: uid() }), []);

  // ---- initial load ----
  useEffect(() => {
    (async () => {
      const [m, t, h] = await Promise.all([
        cloudGet(TABLE_MENU, null),
        cloudGet(TABLE_TABS, []),
        cloudGet(TABLE_HISTORY, []),
      ]);
      if (m === null) {
        // first ever run — seed the cloud store
        await cloudSet(TABLE_MENU, DEFAULT_MENU);
        setMenu(DEFAULT_MENU);
      } else {
        setMenu(m);
      }
      setTabs(t);
      setHistory(h);
      setBooting(false);
    })();
  }, []);

  // ---- background sync poll (so other devices' changes show up here) ----
  useEffect(() => {
    if (booting) return;
    const poll = async () => {
      setSyncState("syncing");
      try {
        const [m, t, h] = await Promise.all([
          cloudGet(TABLE_MENU, menu),
          cloudGet(TABLE_TABS, tabs),
          cloudGet(TABLE_HISTORY, history),
        ]);
        setMenu(m);
        setTabs(t);
        setHistory(h);
        setSyncState("ok");
        lastSyncRef.current = Date.now();
      } catch {
        setSyncState("error");
      }
    };
    const t = setInterval(poll, SYNC_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- writers: update local state immediately + push to cloud ----
  const pushMenu = useCallback(async (updater) => {
    setMenu((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cloudSet(TABLE_MENU, next);
      return next;
    });
  }, []);
  const pushTabs = useCallback(async (updater) => {
    setTabs((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cloudSet(TABLE_TABS, next);
      return next;
    });
  }, []);
  const pushHistory = useCallback(async (updater) => {
    setHistory((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cloudSet(TABLE_HISTORY, next);
      return next;
    });
  }, []);

  const startShift = (person) => {
    setStaff(person);
    setShift({ staffId: person.id, staffName: person.name, startedAt: now() });
    showToast(`Shift started — welcome, ${person.name}`);
  };
  const endShift = () => {
    setStaff(null);
    setShift(null);
    setActiveTabId(null);
    setView("floor");
  };

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <GoogleFonts />
        <Beer size={30} color={C.brass} style={{ animation: "pulse 1.4s ease-in-out infinite" }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
        <div style={{ color: C.textDim, fontSize: 13, fontFamily: "Inter, sans-serif" }}>Loading bar data…</div>
      </div>
    );
  }

  if (!staff) {
    return <LoginScreen onLogin={startShift} openTabCount={tabs.length} />;
  }

  return (
    <div style={styles.app}>
      <GoogleFonts />
      {toast && <Toast toast={toast} />}
      <TopBar shift={shift} view={view} setView={setView} onEndShift={endShift} openTabs={tabs.length} syncState={syncState} />
      <div style={styles.body}>
        {view === "floor" && (
          <FloorView
            menu={menu}
            pushMenu={pushMenu}
            tabs={tabs}
            pushTabs={pushTabs}
            history={history}
            pushHistory={pushHistory}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            shift={shift}
            showToast={showToast}
          />
        )}
        {view === "reports" && <ReportsView history={history} menu={menu} />}
        {view === "menu-admin" && <MenuAdmin menu={menu} pushMenu={pushMenu} showToast={showToast} />}
      </div>
    </div>
  );
}

// ---------- Fonts ----------
function GoogleFonts() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: #2E4643; border-radius: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      button { font-family: inherit; cursor: pointer; }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #C89B3C; outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    `}</style>
  );
}

// ---------- Theme ----------
const C = {
  bg: "#0E1A18",
  panel: "#152624",
  panel2: "#1B2E2B",
  border: "#2A403C",
  text: "#F2EFE9",
  textDim: "#9FB3AE",
  brass: "#C89B3C",
  brassDim: "#8A6E2E",
  amber: "#D68A2E",
  red: "#C4453D",
  green: "#4F9E6E",
};
const styles = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" },
  body: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
};
const displayFont = { fontFamily: "Oswald, sans-serif" };

// ---------- Toast ----------
function Toast({ toast }) {
  return (
    <div key={toast.key} style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
      background: toast.kind === "error" ? C.red : C.panel2,
      border: `1px solid ${toast.kind === "error" ? "#8a2f2a" : C.brass}`,
      color: C.text, padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 8, maxWidth: "90vw",
      animation: "slideDown 0.25s ease-out",
    }}>
      <style>{`@keyframes slideDown { from { opacity:0; transform: translate(-50%,-10px);} to {opacity:1; transform: translate(-50%,0);} }`}</style>
      {toast.kind === "error" ? <AlertTriangle size={16} /> : <Check size={16} />}
      {toast.msg}
    </div>
  );
}

// ---------- Login ----------
function LoginScreen({ onLogin, openTabCount }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 20, fontFamily: "Inter, sans-serif" }}>
      <GoogleFonts />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Beer size={32} color={C.brass} />
        <div style={{ ...displayFont, fontSize: 38, letterSpacing: 1, color: C.text }}>COMMON ROOM BAR</div>
      </div>
      <div style={{ color: C.textDim, fontSize: 14, marginBottom: 8, letterSpacing: 2, textTransform: "uppercase" }}>Reception Desk Point of Sale</div>
      <div style={{ color: C.textDim, fontSize: 12, marginBottom: 32, display: "flex", alignItems: "center", gap: 5 }}>
        <Wifi size={12} /> synced across all desk devices
      </div>

      {!selected ? (
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ color: C.textDim, fontSize: 13, marginBottom: 12, textAlign: "center" }}>Who's on the desk?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {STAFF.map((s) => (
              <button key={s.id} onClick={() => setSelected(s)} style={{
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between", color: C.text, fontSize: 17, fontWeight: 600,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: C.brassDim, display: "flex", alignItems: "center", justifyContent: "center", ...displayFont, fontSize: 16 }}>
                    {s.name[0]}
                  </span>
                  {s.name}
                </span>
                <ChevronRight size={18} color={C.textDim} />
              </button>
            ))}
          </div>
          {openTabCount > 0 && (
            <div style={{ marginTop: 20, textAlign: "center", color: C.amber, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Receipt size={14} /> {openTabCount} tab{openTabCount > 1 ? "s" : ""} currently open on the floor
            </div>
          )}
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 320, textAlign: "center" }}>
          <div style={{ color: C.textDim, fontSize: 13, marginBottom: 4 }}>Enter PIN for</div>
          <div style={{ ...displayFont, fontSize: 24, marginBottom: 20 }}>{selected.name}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 44, height: 52, borderRadius: 8, background: C.panel,
                border: `1px solid ${error ? C.red : C.border}`, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, ...displayFont,
              }}>
                {pin[i] ? "•" : ""}
              </div>
            ))}
          </div>
          {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) => (
              k === "" ? <div key={i} /> :
              <button key={i} onClick={() => {
                if (k === "del") setPin((p) => p.slice(0, -1));
                else if (pin.length < 4) {
                  const next = pin + k;
                  setPin(next);
                  if (next.length === 4) setTimeout(() => {
                    if (next === selected.pin) onLogin(selected);
                    else { setError("Wrong PIN"); setPin(""); setTimeout(() => setError(""), 1200); }
                  }, 100);
                }
              }} style={{
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 0",
                color: C.text, fontSize: 18, fontWeight: 600,
              }}>
                {k === "del" ? "⌫" : k}
              </button>
            ))}
          </div>
          <button onClick={() => { setSelected(null); setPin(""); }} style={{
            marginTop: 20, background: "none", border: "none", color: C.textDim, fontSize: 13, textDecoration: "underline",
          }}>
            Not you? Go back
          </button>
          <div style={{ marginTop: 14, fontSize: 11, color: C.textDim }}>Demo PINs — Rohan 1111 · Priya 2222 · Vikram 3333</div>
        </div>
      )}
    </div>
  );
}

// ---------- Top bar ----------
function TopBar({ shift, view, setView, onEndShift, openTabs, syncState }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const tick = () => {
      const ms = now() - shift.startedAt;
      const mins = Math.floor(ms / 60000);
      const h = Math.floor(mins / 60), m = mins % 60;
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [shift]);

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => setView(id)} style={{
      background: view === id ? C.panel2 : "transparent",
      border: "none", borderRadius: 8, padding: "8px 14px", color: view === id ? C.brass : C.textDim,
      display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600,
    }}>
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px",
      background: C.panel, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, ...displayFont, fontSize: 20, letterSpacing: 0.5 }}>
          <Beer size={20} color={C.brass} /> COMMON ROOM
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <NavBtn id="floor" icon={Receipt} label={`Floor${openTabs ? ` (${openTabs})` : ""}`} />
          <NavBtn id="reports" icon={BarChart3} label="Reports" />
          <NavBtn id="menu-admin" icon={Settings} label="Menu" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div title={syncState === "error" ? "Sync failed — check connection" : "Synced"} style={{ color: syncState === "error" ? C.red : C.textDim, display: "flex", alignItems: "center" }}>
          {syncState === "error" ? <WifiOff size={14} /> : <Wifi size={14} />}
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: C.textDim }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{shift.staffName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <Clock size={11} /> on shift {elapsed}
          </div>
        </div>
        <button onClick={onEndShift} style={{
          background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px",
          color: C.textDim, display: "flex", alignItems: "center", gap: 6, fontSize: 13,
        }}>
          <LogOut size={14} /> End shift
        </button>
      </div>
    </div>
  );
}

// ---------- Floor view ----------
function FloorView({ menu, pushMenu, tabs, pushTabs, history, pushHistory, activeTabId, setActiveTabId, shift, showToast }) {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [category, setCategory] = useState(menu[0]?.category || "Beer");
  const [showNewTab, setShowNewTab] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (activeTabId && !tabs.find((t) => t.id === activeTabId)) setActiveTabId(null);
  }, [tabs, activeTabId, setActiveTabId]);

  const categories = [...new Set(menu.map((m) => m.category))];

  const createTab = (label) => {
    const t = { id: uid(), label: label || `Walk-in ${tabs.length + 1}`, openedBy: shift.staffName, openedAt: now().toISOString(), items: [] };
    pushTabs((prev) => [...prev, t]);
    setActiveTabId(t.id);
    setShowNewTab(false);
  };

  const addItem = (menuItem) => {
    if (!activeTab) { showToast("Open or select a tab first", "error"); return; }
    const stockRemaining = menuItem.stock - reservedQty(tabs, menuItem.id);
    if (stockRemaining <= 0) { showToast(`${menuItem.name} is out of stock`, "error"); return; }
    pushTabs((prev) => prev.map((t) => {
      if (t.id !== activeTab.id) return t;
      const existing = t.items.find((li) => li.menuId === menuItem.id);
      if (existing) return { ...t, items: t.items.map((li) => li.menuId === menuItem.id ? { ...li, qty: li.qty + 1 } : li) };
      return { ...t, items: [...t.items, { id: uid(), menuId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }] };
    }));
  };

  const changeQty = (menuId, delta) => {
    pushTabs((prev) => prev.map((t) => {
      if (t.id !== activeTab.id) return t;
      const items = t.items.map((li) => li.menuId === menuId ? { ...li, qty: li.qty + delta } : li).filter((li) => li.qty > 0);
      return { ...t, items };
    }));
  };

  const removeTab = (tabId) => {
    pushTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) setActiveTabId(null);
  };

  const closeTab = (payMethod) => {
    if (!activeTab) return;
    const cost = activeTab.items.reduce((s, li) => {
      const m = menu.find((mm) => mm.id === li.menuId);
      return s + (m ? Math.round(m.price * 0.55) : 0) * li.qty;
    }, 0);
    const total = activeTab.items.reduce((s, li) => s + li.price * li.qty, 0);
    const closed = {
      id: activeTab.id,
      closedAt: now().toISOString(),
      staff: shift.staffName,
      openedBy: activeTab.openedBy,
      payMethod,
      items: activeTab.items.map((li) => ({ ...li, cost: menu.find((m) => m.id === li.menuId) ? Math.round(menu.find((m) => m.id === li.menuId).price * 0.55) : 0 })),
      total,
      cost,
    };
    pushHistory((prev) => [closed, ...prev]);
    pushMenu((prev) => prev.map((m) => {
      const soldQty = activeTab.items.filter((li) => li.menuId === m.id).reduce((s, li) => s + li.qty, 0);
      return soldQty ? { ...m, stock: m.stock - soldQty } : m;
    }));
    pushTabs((prev) => prev.filter((t) => t.id !== activeTab.id));
    setActiveTabId(null);
    setShowPayment(false);
    showToast(`Tab closed by ${shift.staffName} — ${inr(total)} via ${payMethod}`);
  };

  const filteredMenu = menu.filter((m) => m.category === category);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexWrap: "wrap" }}>
      <div style={{ width: 220, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", background: C.panel }}>
        <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Open Tabs</div>
          <button onClick={() => setShowNewTab(true)} style={{ background: C.brass, border: "none", borderRadius: 6, width: 26, height: 26, color: "#1a1408", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px" }}>
          {tabs.length === 0 && <div style={{ color: C.textDim, fontSize: 13, padding: "20px 10px", textAlign: "center" }}>No tabs open.<br />Tap + to start one.</div>}
          {tabs.map((t) => {
            const total = t.items.reduce((s, li) => s + li.price * li.qty, 0);
            const isActive = t.id === activeTabId;
            return (
              <div key={t.id} onClick={() => setActiveTabId(t.id)} style={{
                background: isActive ? C.panel2 : "transparent", border: `1px solid ${isActive ? C.brass : "transparent"}`,
                borderRadius: 8, padding: "10px 12px", marginBottom: 8, cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
                  <button onClick={(e) => { e.stopPropagation(); removeTab(t.id); }} style={{ background: "none", border: "none", color: C.textDim, padding: 0 }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>opened by {t.openedBy}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>{t.items.length} item{t.items.length !== 1 ? "s" : ""}</span>
                  <span style={{ ...displayFont, fontSize: 15, color: C.amber }}>{inr(total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 280 }}>
        <div style={{ display: "flex", gap: 6, padding: "14px 20px 0", flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={{
              background: category === c ? C.brass : C.panel, color: category === c ? "#1a1408" : C.text,
              border: `1px solid ${category === c ? C.brass : C.border}`, borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 14,
            }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, alignContent: "start" }}>
          {filteredMenu.map((m) => {
            const remaining = m.stock - reservedQty(tabs, m.id);
            const low = remaining <= 8 && remaining > 0;
            const out = remaining <= 0;
            return (
              <button key={m.id} onClick={() => addItem(m)} disabled={out || !activeTab} style={{
                background: C.panel, border: `1px solid ${out ? "#4a2622" : C.border}`, borderRadius: 12, padding: "16px 14px",
                textAlign: "left", opacity: out ? 0.5 : (!activeTab ? 0.7 : 1), position: "relative",
              }}>
                {low && !out && <span style={{ position: "absolute", top: 10, right: 10, background: C.amber, color: "#1a1408", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>LOW: {remaining}</span>}
                {out && <span style={{ position: "absolute", top: 10, right: 10, background: C.red, color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>OUT</span>}
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>{m.category} · {remaining} {m.unit}s left</div>
                <div style={{ ...displayFont, fontSize: 20, color: C.brass }}>{inr(m.price)}</div>
              </button>
            );
          })}
          {filteredMenu.length === 0 && <div style={{ color: C.textDim, fontSize: 13 }}>No items in this category yet — add some under Menu.</div>}
        </div>
        {!activeTab && <div style={{ padding: "10px 20px", color: C.textDim, fontSize: 13, textAlign: "center", borderTop: `1px solid ${C.border}` }}>Select or open a tab on the left to start adding items.</div>}
      </div>

      <div style={{ width: 300, borderLeft: `1px solid ${C.border}`, background: C.panel, display: "flex", flexDirection: "column" }}>
        {activeTab ? (
          <TicketStub tab={activeTab} onChangeQty={changeQty} onPay={() => setShowPayment(true)} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 13, padding: 20, textAlign: "center" }}>No tab selected</div>
        )}
      </div>

      {showNewTab && <NewTabModal rooms={ROOMS} onCreate={createTab} onClose={() => setShowNewTab(false)} tabCount={tabs.length} />}
      {showPayment && activeTab && <PaymentModal tab={activeTab} onClose={() => setShowPayment(false)} onComplete={closeTab} staffName={shift.staffName} />}
    </div>
  );
}

function reservedQty(tabs, menuId) {
  return tabs.reduce((sum, t) => sum + t.items.filter((li) => li.menuId === menuId).reduce((s, li) => s + li.qty, 0), 0);
}

// ---------- Ticket stub ----------
function TicketStub({ tab, onChangeQty, onPay }) {
  const total = tab.items.reduce((s, li) => s + li.price * li.qty, 0);
  const mins = Math.floor((now() - new Date(tab.openedAt)) / 60000);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px dashed ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...displayFont, fontSize: 20 }}>{tab.label}</div>
          <div style={{ fontSize: 11, color: C.textDim }}>{mins}m open</div>
        </div>
        <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: C.panel2, border: `1px solid ${C.brassDim}`, borderRadius: 20, padding: "3px 10px 3px 3px", fontSize: 12 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.brass, color: "#1a1408", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{tab.openedBy[0]}</span>
          opened by <strong>{tab.openedBy}</strong>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 18px" }}>
        {tab.items.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: "30px 0" }}>No items yet. Tap the menu to add.</div>}
        {tab.items.map((li) => (
          <div key={li.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{li.name}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{inr(li.price)} × {li.qty}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => onChangeQty(li.menuId, -1)} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={12} /></button>
              <span style={{ width: 18, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{li.qty}</span>
              <button onClick={() => onChangeQty(li.menuId, 1)} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 18px 18px", borderTop: `1px dashed ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ color: C.textDim, fontSize: 13 }}>Total</span>
          <span style={{ ...displayFont, fontSize: 26, color: C.brass }}>{inr(total)}</span>
        </div>
        <button onClick={onPay} disabled={tab.items.length === 0} style={{
          width: "100%", background: tab.items.length ? C.brass : C.border, border: "none", borderRadius: 10, padding: "14px 0",
          color: tab.items.length ? "#1a1408" : C.textDim, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <IndianRupee size={16} /> Settle & close tab
        </button>
      </div>
    </div>
  );
}

// ---------- New tab modal ----------
function NewTabModal({ rooms, onCreate, onClose, tabCount }) {
  const [mode, setMode] = useState("walkin");
  const [room, setRoom] = useState(rooms[0]);
  const [customName, setCustomName] = useState("");
  return (
    <ModalShell onClose={onClose} title="Open new tab">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <SegBtn active={mode === "walkin"} onClick={() => setMode("walkin")} label="Walk-in" />
        <SegBtn active={mode === "room"} onClick={() => setMode("room")} label="Room tab" />
      </div>
      {mode === "walkin" ? (
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={`Walk-in ${tabCount + 1}`} style={inputStyle} />
      ) : (
        <select value={room} onChange={(e) => setRoom(e.target.value)} style={inputStyle}>
          {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
      <button onClick={() => onCreate(mode === "walkin" ? (customName || `Walk-in ${tabCount + 1}`) : room)} style={primaryBtn}>Open tab</button>
    </ModalShell>
  );
}

// ---------- Payment modal ----------
function PaymentModal({ tab, onClose, onComplete, staffName }) {
  const total = tab.items.reduce((s, li) => s + li.price * li.qty, 0);
  const [method, setMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const methods = [
    { id: "Cash", label: "Cash", icon: IndianRupee, note: "Counted at desk", live: true },
    { id: "UPI", label: "UPI", icon: Receipt, note: "Confirm once received", live: true },
    { id: "Card", label: "Card", icon: Lock, note: "Coming soon — Razorpay", live: false },
    { id: "Room Tab", label: "Room Tab", icon: Users, note: "Add to guest folio", live: true },
  ];

  const handleSelect = (m) => {
    if (!m.live) return;
    setMethod(m.id);
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setDone(true); }, 500);
  };

  return (
    <ModalShell onClose={onClose} title={done ? "Payment confirmed" : "Settle tab"}>
      {!method && (
        <>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ color: C.textDim, fontSize: 13 }}>Amount due</div>
            <div style={{ ...displayFont, fontSize: 36, color: C.brass }}>{inr(total)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {methods.map((m) => (
              <button key={m.id} onClick={() => handleSelect(m)} disabled={!m.live} style={{
                background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 12px",
                color: m.live ? C.text : C.textDim, textAlign: "left", opacity: m.live ? 1 : 0.55, cursor: m.live ? "pointer" : "not-allowed",
              }}>
                <m.icon size={18} color={m.live ? C.brass : C.textDim} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{m.note}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 14, textAlign: "center" }}>
            Card payments will activate here once Razorpay is connected.
          </div>
        </>
      )}

      {method && processing && (
        <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontSize: 14 }}>Confirming…</div>
      )}

      {method && done && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Check size={28} color="#fff" />
          </div>
          <div style={{ ...displayFont, fontSize: 24, marginBottom: 4 }}>{inr(total)} received</div>
          <div style={{ color: C.textDim, fontSize: 13, marginBottom: 24 }}>via {method} · closed by {staffName}</div>
          <button onClick={() => onComplete(method)} style={primaryBtn}>Done — clear tab</button>
        </div>
      )}
    </ModalShell>
  );
}

// ---------- Modal shell ----------
function ModalShell({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ ...displayFont, fontSize: 19 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textDim }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.text, fontSize: 15, marginBottom: 16, fontFamily: "Inter, sans-serif" };
const primaryBtn = { width: "100%", background: C.brass, border: "none", borderRadius: 10, padding: "13px 0", color: "#1a1408", fontWeight: 800, fontSize: 15 };
function SegBtn({ active, onClick, label }) {
  return <button onClick={onClick} style={{ flex: 1, background: active ? C.brass : C.panel2, color: active ? "#1a1408" : C.text, border: `1px solid ${active ? C.brass : C.border}`, borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13 }}>{label}</button>;
}

// ---------- Reports ----------
function ReportsView({ history, menu }) {
  const [range, setRange] = useState("today");

  const filtered = useMemo(() => {
    const today = now();
    const startOfDay = new Date(today); startOfDay.setHours(0,0,0,0);
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - 7);
    const startOfMonth = new Date(today); startOfMonth.setMonth(today.getMonth() - 1);
    const startOfQuarter = new Date(today); startOfQuarter.setMonth(today.getMonth() - 3);
    const cutoffs = { today: startOfDay, week: startOfWeek, month: startOfMonth, quarter: startOfQuarter, all: new Date(0) };
    return history.filter((h) => new Date(h.closedAt) >= cutoffs[range]);
  }, [history, range]);

  const revenue = filtered.reduce((s, h) => s + h.total, 0);
  const cost = filtered.reduce((s, h) => s + h.cost, 0);
  const profit = revenue - cost;
  const orderCount = filtered.length;

  const itemSales = useMemo(() => {
    const map = {};
    filtered.forEach((h) => h.items.forEach((li) => {
      if (!map[li.name]) map[li.name] = { name: li.name, qty: 0, revenue: 0 };
      map[li.name].qty += li.qty;
      map[li.name].revenue += li.price * li.qty;
    }));
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [filtered]);

  const byStaff = useMemo(() => {
    const map = {};
    filtered.forEach((h) => {
      if (!map[h.staff]) map[h.staff] = { name: h.staff, count: 0, revenue: 0 };
      map[h.staff].count += 1;
      map[h.staff].revenue += h.total;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const lowStock = menu.filter((m) => m.stock <= 10);

  const dailySeries = useMemo(() => {
    const days = {};
    filtered.forEach((h) => {
      const key = fmtDate(h.closedAt);
      days[key] = (days[key] || 0) + h.total;
    });
    return Object.entries(days);
  }, [filtered]);
  const maxDaily = Math.max(1, ...dailySeries.map(([, v]) => v));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ ...displayFont, fontSize: 24 }}>Reports</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["today", "Today"], ["week", "7 days"], ["month", "Monthly"], ["quarter", "Quarterly"]].map(([id, label]) => (
            <button key={id} onClick={() => setRange(id)} style={{
              background: range === id ? C.brass : C.panel, color: range === id ? "#1a1408" : C.text,
              border: `1px solid ${range === id ? C.brass : C.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700,
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon={IndianRupee} label="Revenue" value={inr(revenue)} accent={C.brass} />
        <StatCard icon={TrendingUp} label="Profit" value={inr(profit)} accent={C.green} sub={`Cost: ${inr(cost)}`} />
        <StatCard icon={Receipt} label="Orders closed" value={orderCount} accent={C.amber} />
        <StatCard icon={Package} label="Low stock items" value={lowStock.length} accent={lowStock.length ? C.red : C.textDim} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={panelBox}>
          <div style={panelTitle}>Daily revenue</div>
          {dailySeries.length === 0 ? <EmptyNote text="No sales in this range yet." /> : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140, padding: "10px 4px 0" }}>
              {dailySeries.map(([day, val]) => (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>{inr(val)}</div>
                  <div style={{ width: "100%", background: C.brass, borderRadius: "4px 4px 0 0", height: `${(val / maxDaily) * 90 + 4}px` }} />
                  <div style={{ fontSize: 10, color: C.textDim }}>{day}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={panelBox}>
          <div style={panelTitle}>Sales by staff</div>
          {byStaff.length === 0 ? <EmptyNote text="No closed tabs yet." /> : byStaff.map((s) => (
            <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: C.brassDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, ...displayFont }}>{s.name[0]}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.brass }}>{inr(s.revenue)}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>{s.count} tab{s.count !== 1 ? "s" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={panelBox}>
          <div style={panelTitle}>Highest selling items</div>
          {itemSales.length === 0 ? <EmptyNote text="No sales yet." /> : itemSales.slice(0, 6).map((it, i) => (
            <div key={it.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.textDim, fontSize: 12, width: 16 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{it.qty} sold</div>
                <div style={{ fontSize: 10, color: C.textDim }}>{inr(it.revenue)}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={panelBox}>
          <div style={panelTitle}>Inventory — pending / low</div>
          {menu.map((m) => {
            const pct = Math.min(100, (m.stock / 50) * 100);
            const low = m.stock <= 10;
            return (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span style={{ color: low ? C.red : C.textDim, fontWeight: 700 }}>{m.stock} {m.unit}s</span>
                </div>
                <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: low ? C.red : C.brass, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const panelBox = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 };
const panelTitle = { fontSize: 13, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 };

function StatCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <Icon size={16} color={accent} style={{ marginBottom: 8 }} />
      <div style={{ ...displayFont, fontSize: 26, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function EmptyNote({ text }) {
  return <div style={{ color: C.textDim, fontSize: 13, padding: "20px 0", textAlign: "center" }}>{text}</div>;
}

// ---------- Menu admin ----------
function MenuAdmin({ menu, pushMenu, showToast }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Beer", price: "", stock: "", unit: "bottle" });
  const categories = [...new Set(menu.map((m) => m.category))];

  const openEdit = (item) => { setEditing(item.id); setForm({ name: item.name, category: item.category, price: item.price, stock: item.stock, unit: item.unit }); };
  const openNew = () => { setEditing("new"); setForm({ name: "", category: categories[0] || "Beer", price: "", stock: "", unit: "bottle" }); };
  const save = () => {
    if (!form.name.trim() || !form.price) { showToast("Name and price are required", "error"); return; }
    if (editing === "new") {
      pushMenu((prev) => [...prev, { id: uid(), name: form.name, category: form.category, price: Number(form.price), stock: Number(form.stock) || 0, unit: form.unit }]);
      showToast(`${form.name} added to menu`);
    } else {
      pushMenu((prev) => prev.map((m) => m.id === editing ? { ...m, name: form.name, category: form.category, price: Number(form.price), stock: Number(form.stock) || 0, unit: form.unit } : m));
      showToast(`${form.name} updated`);
    }
    setEditing(null);
  };
  const remove = (id) => {
    const item = menu.find((m) => m.id === id);
    pushMenu((prev) => prev.filter((m) => m.id !== id));
    showToast(`${item.name} removed from menu`);
  };
  const restock = (id, amount) => pushMenu((prev) => prev.map((m) => m.id === id ? { ...m, stock: Math.max(0, m.stock + amount) } : m));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...displayFont, fontSize: 24 }}>Menu & inventory</div>
        <button onClick={openNew} style={{ background: C.brass, border: "none", borderRadius: 8, padding: "9px 16px", color: "#1a1408", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Add item
        </button>
      </div>

      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {menu.filter((m) => m.category === cat).map((m) => (
              <div key={m.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                    <div style={{ ...displayFont, fontSize: 17, color: C.brass, marginTop: 2 }}>{inr(m.price)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(m)} style={iconBtn}><Edit3 size={13} /></button>
                    <button onClick={() => remove(m.id)} style={iconBtn}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: m.stock <= 10 ? C.red : C.textDim, fontWeight: 600 }}>{m.stock} {m.unit}s in stock</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => restock(m.id, -1)} style={{ ...iconBtn, width: 22, height: 22 }}><Minus size={11} /></button>
                    <button onClick={() => restock(m.id, 12)} style={{ ...iconBtn, width: 22, height: 22 }}><Plus size={11} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <ModalShell onClose={() => setEditing(null)} title={editing === "new" ? "Add menu item" : "Edit menu item"}>
          <input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input placeholder="Category (e.g. Beer, Snacks)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} />
          <input placeholder="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} />
          <input placeholder="Stock quantity" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} style={inputStyle} />
          <input placeholder="Unit (bottle, plate...)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={inputStyle} />
          <button onClick={save} style={primaryBtn}>Save item</button>
        </ModalShell>
      )}
    </div>
  );
}
const iconBtn = { background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim };
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { storage } from './storage';

export default function App() {
  // Global integrated states
  const [appData, setAppData] = useState(storage.getData());
  const [activeTab, setActiveTab] = useState('billing'); // billing, inventory, orders, analytics

  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Billing states
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeInvoice, setActiveInvoice] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [currentBillTotal, setCurrentBillTotal] = useState(0);
  const [currentCostTotal, setCurrentCostTotal] = useState(0);
  const [currentItemsDesc, setCurrentItemsDesc] = useState('');
  const qrCanvasRef = useRef(null);

  // New product form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdPP, setNewProdPP] = useState('');
  const [newProdSP, setNewProdSP] = useState('');
  const [newProdStock, setNewProdStock] = useState('');

  // Renders the automatic dynamic payment QR code based on billing status
  useEffect(() => {
    if (!qrCanvasRef.current || currentBillTotal <= 0) return;

    const formattedAmount = parseFloat(currentBillTotal).toFixed(2);
    const upiPayload = `upi://pay?pa=${appData.merchantConfig.upiId}` +
                       `&pn=${encodeURIComponent(appData.merchantConfig.businessName)}` +
                       `&am=${formattedAmount}` +
                       `&tr=${activeInvoice}` +
                       `&tn=${encodeURIComponent(`Invoice #${activeInvoice}`)}` +
                       `&cu=INR`;

    QRCode.toCanvas(qrCanvasRef.current, upiPayload, {
      width: 200,
      margin: 1,
      color: { dark: '#1e293b', light: '#ffffff' }
    }, (err) => {
      if (err) console.error("QR display error:", err);
    });
  }, [currentBillTotal, activeInvoice, appData.merchantConfig]);

  // Authenticate user against seed information records
  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = appData.users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (foundUser) {
      const updatedData = { ...appData, userSession: foundUser.username };
      setAppData(updatedData);
      storage.saveData(updatedData);
      setLoginError('');
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Invalid username or password credentials.');
    }
  };

  // Sign out handler
  const handleLogout = () => {
    const updatedData = { ...appData, userSession: null };
    setAppData(updatedData);
    storage.saveData(updatedData);
  };

  // Handle local dynamic additions to current basket
  const handleGenerateBill = (e) => {
    e.preventDefault();
    const prod = appData.inventory.find(i => i.id === selectedProduct);
    if (!prod) return;

    const billingSum = prod.sellingPrice * parseInt(quantity);
    const costSum = prod.purchasePrice * parseInt(quantity);
    
    setCurrentBillTotal(billingSum);
    setCurrentCostTotal(costSum);
    setCurrentItemsDesc(`${prod.name} x${quantity}`);
    setActiveInvoice(`INV-${Date.now().toString().slice(-6)}`);
  };

  // Mark invoice paid, deduct stock inventory, and archive details into storage log
  const handleConfirmPayment = () => {
    const updatedInventory = appData.inventory.map(item => {
      if (item.id === selectedProduct) {
        return { ...item, stock: Math.max(0, item.stock - parseInt(quantity)) };
      }
      return item;
    });

    const refreshedData = { ...appData, inventory: updatedInventory };
    storage.saveData(refreshedData);
    
    const finalState = storage.commitOrder(currentBillTotal, activeInvoice, currentItemsDesc, currentCostTotal);
    setAppData(finalState);
    
    setCurrentBillTotal(0);
    setCurrentCostTotal(0);
    setCurrentItemsDesc('');
    alert(`Order ${activeInvoice} safely accounted for and completed successfully!`);
  };

  // Manage updates to live Product Selling/Purchase costs across inventory files
  const handleUpdatePrices = (productId, key, updatedValue) => {
    const updatedInventory = appData.inventory.map(item => {
      if (item.id === productId) {
        return { ...item, [key]: parseFloat(updatedValue) || 0 };
      }
      return item;
    });
    const nextState = { ...appData, inventory: updatedInventory };
    setAppData(nextState);
    storage.saveData(nextState);
  };

  // Add items into Inventory profile tracking metrics
  const handleAddNewProduct = (e) => {
    e.preventDefault();
    if (!newProdName || !newProdPP || !newProdSP) return;

    const newItem = {
      id: `PROD-${Date.now().toString().slice(-4)}`,
      name: newProdName,
      purchasePrice: parseFloat(newProdPP),
      sellingPrice: parseFloat(newProdSP),
      stock: parseInt(newProdStock) || 0
    };

    const nextState = { ...appData, inventory: [...appData.inventory, newItem] };
    setAppData(nextState);
    storage.saveData(nextState);

    setNewProdName('');
    setNewProdPP('');
    setNewProdSP('');
    setNewProdStock('');
  };

  // Computing operational analytics matrices metrics dynamically
  const totals = appData.orders.reduce((acc, order) => {
    acc.revenue += order.amount;
    acc.profit += order.profit;
    return acc;
  }, { revenue: 0, profit: 0 });

  // 🚪 SIGN IN ROUTE LAYOUT VIEW (Renders if userSession is inactive)
  if (!appData.userSession) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Sign In to Ledger</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Enter your administrator access criteria</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g., admin" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
            </div>

            {loginError && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 16px 0', fontWeight: '500' }}>{loginError}</p>}

            <button type="submit" style={{ width: '100%', backgroundColor: '#2563eb', color: '#ffffff', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>Login</button>
          </form>

          <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#64748b', border: '1px dashed #e2e8f0' }}>
            <strong>Seed Login Info:</strong><br />
            Username: <code style={{ color: '#0f172a' }}>admin</code><br />
            Password: <code style={{ color: '#0f172a' }}>password123</code>
          </div>
        </div>
      </div>
    );
  }

  // 🖥️ MAIN APPLICATIVE DASHBOARD VIEW (Renders if userSession is active)
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      
      {/* Upper Navigation Row Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
        <h1 style={{ color: '#0f172a', margin: 0, fontSize: '24px' }}>🏪 Smart Retail Management</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
          <nav style={{ display: 'flex', gap: '6px' }}>
            {['billing', 'inventory', 'orders', 'analytics'].map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                  backgroundColor: activeTab === tab ? '#2563eb' : '#e2e8f0',
                  color: activeTab === tab ? '#ffffff' : '#475569'
                }}
              >
                {tab === 'billing' ? '🛒 Quick Bill POS' : tab === 'inventory' ? '📦 Stock Inventory' : tab === 'orders' ? '📜 Order History' : '📊 Profit Analytics'}
              </button>
            ))}
          </nav>
          
          <button onClick={handleLogout} style={{ padding: '8px 12px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>🚪 Logout</button>
        </div>
      </header>

      {/* VIEW SECTION A: POS DYNAMIC BILLING GATEWAY WITH AUTO QR CODE MODULE */}
      {activeTab === 'billing' && (
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}><div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ marginTop: 0, color: '#1e293b' }}>Generate New Automated Bill<div style={{ marginBottom: '16px' }}>
Select Line Item<select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required>-- Choose Stock SKU --{appData.inventory.map(item => ({item.name} (In Stock: {item.stock} | Price: ₹{item.sellingPrice})))}
<div style={{ marginBottom: '20px' }}>Units Ordered (Quantity)<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required /><button type="submit" style={{ width: '100%', backgroundColor: '#10b981', color: '#ffffff', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Generate Payment Intent Link


<div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>{currentBillTotal > 0 ? (<div style={{ textAlign: 'center' }}><span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{activeInvoice}<div style={{ margin: '16px 0' }}><h2 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>₹{currentBillTotal.toFixed(2)}<p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>{currentItemsDesc}<button onClick={handleConfirmPayment} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '10px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Simulate Verification Success

) : (<p style={{ color: '#64748b', textAlign: 'center', margin: 0 }}>Awaiting bill parameters...Enter inputs to dynamically update client checkouts.)})}{/* VIEW SECTION B: DYNAMIC PURCHASE & STOCK MANAGEMENT INVENTORY MODULATOR */}{activeTab === 'inventory' && (<div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ marginTop: 0 }}>Inventory Intake Log Form

<form onSubmit={handleAddNewProduct} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}><input type="text" placeholder="Item Name" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: '2 1 200px' }} required /><input type="number" placeholder="Cost Price (₹)" value={newProdPP} onChange={(e) => setNewProdPP(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: '1 1 100px' }} required /><input type="number" placeholder="Sale Price (₹)" value={newProdSP} onChange={(e) => setNewProdSP(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: '1 1 100px' }} required /><input type="number" placeholder="Initial Stock" value={newProdStock} onChange={(e) => setNewProdStock(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: '1 1 100px' }} required /><button type="submit" style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Inward SKU<div style={{ overflowX: 'auto' }}>)}{/* VIEW SECTION C: AUDIT ORDER LOGGING ARCHIVE */}{activeTab === 'orders' && (<div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ marginTop: 0 }}>Historical Invoiced Checkout Orders<div style={{ overflowX: 'auto' }}>

)}{/* VIEW SECTION D: REVENUE, MARGIN CHANGES & CALCULATE PROFIT REPORTS */}{activeTab === 'analytics' && (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}><div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #2563eb' }}><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>Aggregated Gross Revenue<h1 style={{ margin: '8px 0 0 0', color: '#1e293b' }}>₹{totals.revenue.toFixed(2)}<div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #16a34a' }}><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '12px', fontWeight: 'bold' }}>Operational Net Profit<h1 style={{ margin: '8px 0 0 0', color: '#16a34a' }}>₹{totals.profit.toFixed(2)}<div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><h3 style={{ marginTop: 0, marginBottom: '6px' }}>Manage Unit Financial Margins<p style={{ color: '#64748b', fontSize: '14px', marginTop: 0, marginBottom: '20px' }}>Adjust cost rates dynamically below. Changes apply instantly to checkout updates and performance forecasting templates.<div style={{ overflowX: 'auto' }}>)});}
