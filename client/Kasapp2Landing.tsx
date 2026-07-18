import { useState, useEffect } from "react";

const GREEN = "#16A34A";
const DARK_GREEN = "#0F3D24";
const LIGHT_GREEN_BG = "#EAF6EF";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const CARD_BG = "#F0FBF4";
const WHITE = "#FFFFFF";

const GITHUB = "https://github.com/Balor44/kasapp2";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const CHAT_MESSAGES = [
  { from: "user", text: "/balance", time: "9:41 AM" },
  { from: "bot", text: "Your Kaspa Balance\n123.456 KAS\napprox 145,678.90 NGN", time: "9:41 AM" },
  { from: "user", text: "/send 08012345678 10", time: "9:42 AM" },
  { from: "bot", text: "Sent 10 KAS to\n08012345678\nTxID: 3f7a...8c2d", time: "9:42 AM" },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

const KaspaLogo = ({ size = 28 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.3, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <path d="M6 3L16 12L6 21" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 3L20 12L13 21" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  </div>
);

const IconWrap = ({ children, size = 44 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.27, background: LIGHT_GREEN_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {children}
  </div>
);

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={GREEN}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const BoltIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const CoinsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const UsersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

function WhatsAppMockup({ activeMsg, small }) {
  const w = small ? 220 : 260;
  return (
    <div style={{ width: w, background: "#111", borderRadius: 28, padding: "10px 5px", boxShadow: "0 30px 60px rgba(15,61,36,0.22)", border: "1px solid #222", margin: "0 auto" }}>
      <div style={{ background: "#075E54", borderRadius: "20px 20px 0 0", padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M6 3L16 12L6 21" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div style={{ color: "white", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            Kasapp <span style={{ color: "#4FC3F7", fontSize: 10 }}>✓</span>
          </div>
          <div style={{ color: "#B5E8D5", fontSize: 9 }}>online</div>
        </div>
      </div>
      <div style={{ background: "#ECE5DD", minHeight: small ? 260 : 300, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 5, overflowY: "auto", maxHeight: small ? 260 : 300 }}>
        {CHAT_MESSAGES.slice(0, activeMsg + 1).map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.from === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              background: msg.from === "user" ? "#DCF8C6" : "white",
              borderRadius: msg.from === "user" ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
              padding: "6px 9px", maxWidth: "85%",
              boxShadow: "0 1px 1px rgba(0,0,0,0.1)"
            }}>
              <div style={{ color: "#111", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-line", fontWeight: msg.text.startsWith("Your") || msg.text.startsWith("Sent") ? 600 : 400 }}>
                {msg.text.includes("Sent") && <span style={{ color: GREEN }}>✓ </span>}
                {msg.text.includes("Balance") && <span>⚠️ </span>}
                {msg.text}
              </div>
              <div style={{ color: "#8696A0", fontSize: 8, textAlign: "right", marginTop: 2 }}>{msg.time}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#F0F0F0", borderRadius: "0 0 20px 20px", padding: "7px 9px", display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ flex: 1, background: "white", borderRadius: 20, padding: "5px 10px", color: "#8696A0", fontSize: 10 }}>Type a message</div>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
        </div>
      </div>
    </div>
  );
}

export default function KasappLanding() {
  const [activeMsg, setActiveMsg] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState("idle");
  const [waitlistNumber, setWaitlistNumber] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMsg(m => (m + 1) % CHAT_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const joinWaitlist = async () => {
    if (!phone.trim()) return;
    setWaitlistStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaitlistStatus("success");
        setWaitlistNumber(data.number);
      } else {
        setWaitlistStatus("error");
        if (data.number) setWaitlistNumber(data.number);
      }
    } catch {
      setWaitlistStatus("error");
    }
  };

  return (
    <div style={{ background: WHITE, color: TEXT, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

      <style>{`
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100%; }
        @media (max-width: 900px) {
          .kasapp-nav-links { display: none !important; }
          .kasapp-mobile-btn { display: flex !important; }
          .kasapp-hero-grid { grid-template-columns: 1fr !important; text-align: center; }
          .kasapp-hero-cta { justify-content: center !important; }
          .kasapp-hero-badge { margin-left: auto; margin-right: auto; }
          .kasapp-hero-launch-card { margin-left: auto; margin-right: auto; }
          .kasapp-top-features { grid-template-columns: repeat(2, 1fr) !important; }
          .kasapp-why-grid { grid-template-columns: 1fr 1fr !important; }
          .kasapp-how-grid { grid-template-columns: 1fr 1fr !important; }
          .kasapp-bottom-grid { grid-template-columns: 1fr 1fr !important; }
          .kasapp-hero-title { font-size: 30px !important; }
          .kasapp-hero-p { max-width: 100% !important; }
        }
        @media (max-width: 520px) {
          .kasapp-top-features { grid-template-columns: 1fr !important; }
          .kasapp-why-grid { grid-template-columns: 1fr !important; }
          .kasapp-how-grid { grid-template-columns: 1fr !important; }
          .kasapp-bottom-grid { grid-template-columns: 1fr !important; }
          .kasapp-hero-title { font-size: 26px !important; }
          .kasapp-section-pad { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid " + BORDER, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <KaspaLogo size={28} />
          <span style={{ fontWeight: 800, fontSize: 16 }}>Kasapp</span>
        </div>
        <div className="kasapp-nav-links" style={{ display: "flex", gap: 22, alignItems: "center" }}>
          {NAV_LINKS.map(n => (
            <a key={n.label} href={n.href} style={{ color: n.label === "Home" ? GREEN : "#334155", fontSize: 13, fontWeight: 500, textDecoration: "none", borderBottom: n.label === "Home" ? "2px solid " + GREEN : "none", paddingBottom: 4 }}>{n.label}</a>
          ))}
          <button onClick={() => document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" })} style={{ background: GREEN, color: "white", border: "none", borderRadius: 24, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            Join Waitlist →
          </button>
        </div>
        <button className="kasapp-mobile-btn" onClick={() => setMenuOpen(!menuOpen)} style={{ display: "none", background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 4 }}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {menuOpen && (
        <div style={{ position: "fixed", top: 58, left: 0, right: 0, background: "white", borderBottom: "1px solid " + BORDER, zIndex: 99, padding: 16, boxShadow: "0 8px 20px rgba(0,0,0,0.08)" }}>
          {NAV_LINKS.map(n => (
            <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} style={{ display: "block", color: TEXT, fontSize: 15, textDecoration: "none", padding: "10px 0", borderBottom: "1px solid " + BORDER }}>{n.label}</a>
          ))}
          <button onClick={() => { setMenuOpen(false); document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" }); }} style={{ width: "100%", marginTop: 14, background: GREEN, color: "white", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Join Waitlist →
          </button>
        </div>
      )}

      {/* HERO */}
      <section id="home" className="kasapp-section-pad" style={{ background: LIGHT_GREEN_BG, padding: "40px 24px 48px" }}>
        <div className="kasapp-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <div className="kasapp-hero-badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", border: "1px solid " + BORDER, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: TEXT, marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
              Built on Kaspa
            </div>
            <h1 className="kasapp-hero-title" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px" }}>
              Money. Fast. Simple.<br />
              <span style={{ color: GREEN }}>Private. For Everyone.</span>
            </h1>
            <p className="kasapp-hero-p" style={{ color: MUTED, fontSize: 15, lineHeight: 1.7, marginBottom: 26, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              Kasapp brings the power of Kaspa (KAS) to your WhatsApp. Send, receive, and use KAS with simple commands — no complicated wallets, no stress.
            </p>
            <div className="kasapp-hero-cta" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              <button onClick={() => document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" })} style={{ background: GREEN, color: "white", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                <WhatsAppIcon /> Join on WhatsApp
              </button>
              <a href="#how-it-works" style={{ background: "white", color: TEXT, border: "1px solid " + BORDER, borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}>
                ▶ How It Works
              </a>
            </div>
            <div className="kasapp-hero-launch-card" style={{ background: "white", border: "1px solid " + BORDER, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, maxWidth: 380 }}>
              <div style={{ width: 4, height: 32, background: "linear-gradient(180deg, #16A34A, white, #16A34A)", borderRadius: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Launching in Nigeria First</div>
                <div style={{ color: MUTED, fontSize: 11 }}>Expanding across Africa soon</div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 18 }}>🌍</span>
            </div>
          </div>
          <div>
            <WhatsAppMockup activeMsg={activeMsg} small={isMobile} />
          </div>
        </div>

        <div className="kasapp-top-features" style={{ maxWidth: 1180, margin: "32px auto 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { icon: <WhatsAppIcon />, title: "WhatsApp Enabled", desc: "Use Kasapp on WhatsApp just like chatting" },
            { icon: <BoltIcon />, title: "Instant Transactions", desc: "Powered by Kaspa's blazing-fast network" },
            { icon: <CoinsIcon />, title: "Low Fees", desc: "Enjoy ultra-low fees on every transaction" },
            { icon: <ShieldIcon />, title: "Private & Secure", desc: "Your keys, your money, your privacy" },
          ].map((f, i) => (
            <div key={i} style={{ background: "white", border: "1px solid " + BORDER, borderRadius: 16, padding: "16px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <IconWrap size={38}>{f.icon}</IconWrap>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{f.title}</div>
                <div style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY KASAPP */}
      <section id="features" className="kasapp-section-pad" style={{ padding: "56px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Why <span style={{ color: GREEN }}>Kasapp</span>?</h2>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 36 }}>Built for everyday people. Designed for Africa. Powered by Kaspa.</p>
        <div className="kasapp-why-grid" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { icon: <PhoneIcon />, title: "Simple as WhatsApp", desc: "No complex apps. Just chat and transact using easy commands." },
            { icon: <BoltIcon />, title: "Blazing Fast", desc: "Kaspa is one of the fastest blockchains in the world. Transactions in seconds." },
            { icon: <CoinsIcon />, title: "Low Cost", desc: "Tiny fees mean you keep more of your money. Perfect for everyday use." },
            { icon: <ShieldIcon />, title: "Secure & Private", desc: "Built with security and privacy in mind. You're in control of your funds." },
          ].map((f, i) => (
            <div key={i} style={{ background: CARD_BG, border: "1px solid " + BORDER, borderRadius: 16, padding: "22px 18px", textAlign: "left" }}>
              <IconWrap>{f.icon}</IconWrap>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "12px 0 6px" }}>{f.title}</div>
              <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="kasapp-section-pad" style={{ padding: "48px 24px", background: LIGHT_GREEN_BG }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 32 }}>How It Works</h2>
        <div className="kasapp-how-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { n: "1", title: "Save Kasapp's Number", desc: "Add the Kasapp WhatsApp number to your contacts." },
            { n: "2", title: "Say Hi", desc: "Send a message to activate your wallet instantly." },
            { n: "3", title: "Send or Receive", desc: "Use simple commands like /send or /balance." },
            { n: "4", title: "Enjoy", desc: "Fast, private, low-cost money — anytime, anywhere." },
          ].map((s, i) => (
            <div key={i} style={{ background: "white", borderRadius: 16, padding: "20px 14px", textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: GREEN, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, margin: "0 auto 12px", fontSize: 14 }}>{s.n}</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>{s.title}</div>
              <div style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist-form" className="kasapp-section-pad" style={{ padding: "56px 24px" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Join the Waitlist</h2>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>Be first to use Kasapp when we launch in Nigeria.</p>

          {waitlistStatus === "success" ? (
            <div style={{ background: CARD_BG, border: "1px solid " + GREEN + "44", borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Your waitlist number</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: GREEN }}>#{waitlistNumber}</div>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 12 }}>We'll message you on WhatsApp when Kasapp launches.</p>
            </div>
          ) : (
            <div style={{ background: "white", border: "1px solid " + BORDER, borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && joinWaitlist()}
                placeholder="e.g. 08012345678"
                style={{ width: "100%", border: "1px solid " + BORDER, borderRadius: 10, padding: "11px 13px", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
              />
              {waitlistStatus === "error" && (
                <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 10 }}>
                  {waitlistNumber ? "Already on the waitlist. Your number is #" + waitlistNumber : "Something went wrong. Try again."}
                </div>
              )}
              <button onClick={joinWaitlist} disabled={waitlistStatus === "loading"} style={{ width: "100%", background: GREEN, color: "white", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {waitlistStatus === "loading" ? "Joining..." : "Join Waitlist"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* BOTTOM BANNER */}
      <section style={{ background: DARK_GREEN, padding: "32px 20px" }}>
        <div className="kasapp-bottom-grid" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {[
            { icon: <UsersIcon />, title: "Built on Kaspa", desc: "The fastest PoW network" },
            { icon: <UsersIcon />, title: "For Everyone", desc: "Designed for the next billion users" },
            { icon: "🇳🇬", title: "Nigeria First", desc: "Launching in Nigeria, expanding across Africa" },
            { icon: <GlobeIcon />, title: "Open & Decentralized", desc: "Open source. Community driven." },
          ].map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {b.icon}
              </div>
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{b.title}</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11.5, lineHeight: 1.5 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="kasapp-section-pad" style={{ padding: "24px 20px", borderTop: "1px solid " + BORDER, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <KaspaLogo size={22} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>Kasapp</span>
          <span style={{ color: MUTED, fontSize: 11 }}>2026 Kasapp. All rights reserved.</span>
        </div>
        <a href={GITHUB} target="_blank" rel="noreferrer" style={{ color: MUTED, fontSize: 12, textDecoration: "none" }}>GitHub</a>
      </footer>
    </div>
  );
}
