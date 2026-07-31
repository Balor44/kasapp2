import { useState, useEffect, useRef, FC } from "react";


/* ============================================
   TYPES & INTERFACES
============================================ */


type MessageFrom = "user" | "bot";


interface ScriptMessage {
  from: MessageFrom;
  text: string;
}


interface BubbleProps {
  from: MessageFrom;
  text: string;
  cursor?: boolean;
}


interface CapabilityItem {
  t: string;
  d: string;
}


interface FAQItem {
  q: string;
  a: string;
}


/* ============================================
   DESIGN CONSTANTS
============================================ */


const INK = "#0C1210";
const SURFACE = "#141C19";
const SURFACE_2 = "#1A2420";
const PAPER = "#E8ECE9";
const DIM = "#8FA39A";
const DIM_2 = "#54655E";
const LINE = "rgba(232,236,233,0.09)";
const LINE_STRONG = "rgba(232,236,233,0.16)";
const GREEN = "#3ED598";
const AMBER = "#F2A65A";


const SERIF = "'Fraunces', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'Inter', system-ui, sans-serif";


const GITHUB = "https://github.com/Balor44/kasapp2";
const KASPA_UNIVERSITY = "https://kaspa.university/";


const NAV = [
  { label: "Product", href: "#product" },
  { label: "Story", href: "#story" },
  { label: "Metrics & ROI", href: "#metrics" },
  { label: "Security", href: "#security" },
  { label: "Learn Kaspa", href: "#learn" },
  { label: "FAQ", href: "#faq" },
];


/* ---------- Live BlockDAG Signature ---------- */


export const BlockDag: FC = () => {
  const [tick, setTick] = useState<number>(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(id);
  }, []);


  const nodes = [
    { x: 20, y: 60, r: 0 }, { x: 20, y: 110, r: 0 },
    { x: 90, y: 40, r: 1 }, { x: 90, y: 85, r: 1 }, { x: 90, y: 130, r: 1 },
    { x: 160, y: 60, r: 2 }, { x: 160, y: 105, r: 2 },
    { x: 230, y: 85, r: 3 },
  ];
  const edges = [
    [0, 2], [0, 3], [1, 3], [1, 4],
    [2, 5], [3, 5], [3, 6], [4, 6],
    [5, 7], [6, 7],
  ];
  const activeRound = tick % 4;


  return (
    <svg width="250" height="170" viewBox="0 0 250 170" style={{ overflow: "visible" }}>
      {edges.map(([a, b], i) => {
        const n1 = nodes[a], n2 = nodes[b];
        const lit = n1.r <= activeRound && n2.r <= activeRound;
        return (
          <line
            key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
            stroke={lit ? GREEN : LINE_STRONG} strokeWidth={lit ? 1.4 : 1}
            style={{ transition: "stroke 0.6s ease" }}
          />
        );
      })}
      {nodes.map((n, i) => {
        const active = n.r === activeRound;
        const lit = n.r <= activeRound;
        return (
          <g key={i}>
            {active && (
              <circle cx={n.x} cy={n.y} r={11} fill="none" stroke={GREEN} strokeWidth="1" opacity="0.5">
                <animate attributeName="r" values="7;15" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={n.x} cy={n.y} r={active ? 7 : 5.5}
              fill={lit ? GREEN : SURFACE_2}
              stroke={lit ? GREEN : LINE_STRONG}
              strokeWidth="1.5"
              style={{ transition: "all 0.6s ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
};


/* ---------- Typed Conversation Component ---------- */


const SCRIPT: ScriptMessage[] = [
  { from: "user", text: "Hi" },
  { from: "bot", text: "⚡ Wallet ready.\nkaspa:qq83x…9a2\n\nCommands: /balance, /send, /airtime" },
  { from: "user", text: "/balance" },
  { from: "bot", text: "1,240.0000 KAS\n≈ ₦186,000" },
  { from: "user", text: "/send 08123456789 50" },
  { from: "bot", text: "✅ Sent — confirmed by BlockDAG in 0.9s\nTxID: 7b14b7…60da1" },
  { from: "user", text: "/airtime MTN 08012345678 1000" },
  { from: "bot", text: "🎉 Airtime Dispatched!\n₦1,000 MTN Airtime delivered." }
];


function useTypedConversation() {
  const [visible, setVisible] = useState<ScriptMessage[]>([]);
  const [typing, setTyping] = useState<ScriptMessage | null>(null);
  const idx = useRef<number>(0);
  const ch = useRef<number>(0);


  useEffect(() => {
    let cancelled = false;
    function step() {
      if (cancelled) return;
      const i = idx.current % SCRIPT.length;
      if (i === 0 && ch.current === 0) setVisible([]);
      const scriptItem = SCRIPT[i];
      ch.current += Math.max(1, Math.floor(scriptItem.text.length / 16));
      setTyping({ from: scriptItem.from, text: scriptItem.text.slice(0, ch.current) });
      if (ch.current >= scriptItem.text.length) {
        setVisible((p) => p.concat([scriptItem]));
        setTyping(null);
        ch.current = 0;
        idx.current += 1;
        setTimeout(step, scriptItem.from === "user" ? 600 : 1300);
      } else {
        setTimeout(step, 28);
      }
    }
    const t = setTimeout(step, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);


  return { visible, typing };
}


export const Bubble: FC<BubbleProps> = ({ from, text, cursor }) => {
  const isUser = from === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%", fontFamily: isUser ? SANS : MONO, fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-line",
        color: isUser ? INK : GREEN,
        background: isUser ? PAPER : "rgba(62,213,152,0.08)",
        border: isUser ? "none" : "1px solid rgba(62,213,152,0.22)",
        borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
        padding: "8px 12px",
      }}>
        {text}{cursor && <span style={{ opacity: 0.5 }}>▌</span>}
      </div>
    </div>
  );
};


export const Conversation: FC = () => {
  const { visible, typing } = useTypedConversation();
  const scrollRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visible, typing]);


  return (
    <div style={{ width: "min(350px, 88vw)", background: SURFACE, border: "1px solid " + LINE_STRONG, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: SURFACE_2, borderBottom: "1px solid " + LINE, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />
        <span style={{ fontFamily: MONO, fontSize: 12, color: PAPER, fontWeight: 500 }}>Kasapp Engine v22.0</span>
      </div>
      <div ref={scrollRef} style={{ minHeight: 280, maxHeight: 280, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((m, i) => <Bubble key={i} from={m.from} text={m.text} />)}
        {typing && <Bubble from={typing.from} text={typing.text} cursor />}
      </div>
    </div>
  );
};


/* ---------- Main Landing Page ---------- */


export default function KasappLanding() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [number, setNumber] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number>(-1);


  const joinWaitlist = async () => {
    if (!phone.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      if (res.ok) { setStatus("success"); setNumber(data.number); }
      else { setStatus("error"); if (data.number) setNumber(data.number); }
    } catch { setStatus("error"); }
  };


  const CAPABILITIES: CapabilityItem[] = [
    { t: "P2P Transfers", d: "Send KAS to any phone number. Auto-provisions unregistered users with instant WhatsApp alerts." },
    { t: "Voucher Cash-In", d: "Redeem OTC merchant cash vouchers (/redeem) without entering exchange KYC queues." },
    { t: "Utility Bills", d: "Direct 1-tap settlement for Airtime, Mobile Data, Electricity Meters, Cable TV, and Water." },
    { t: "Autopilot Renewals", d: "Configure recurring background automation rules (/auto) for monthly subscriptions." },
  ];


  const FAQS: FAQItem[] = [
    { q: "What is Kasapp?", a: "Kasapp is a WhatsApp-native payment engine built on Kaspa Layer-1. It abstracts seed phrases and exchange KYC into everyday chat commands, allowing users to send KAS and settle utility bills in seconds." },
    { q: "Why use Kaspa for bill payments in Africa?", a: "Kaspa's BlockDAG achieves sub-second finality with negligible fees. Traditional crypto transfers are ruined by heavy withdrawal surcharges and slow confirmations; Kasapp makes micro-payments practical." },
    { q: "How are keys secured against server compromise?", a: "Mnemonics are encrypted at rest using AES-256-GCM. Viewing seeds (/export) or updating settings strictly requires salted bcrypt PIN authentication. Additionally, 90% of system funds sit in an offline 2-of-3 Kaspa Multi-Sig Vault." },
    { q: "How does Kasapp scale network adoption?", a: "Every /send command sent to an unregistered recipient automatically provisions a new Kaspa wallet and dispatches a notification, creating an organic acquisition loop across university communities." },
    { q: "Want to learn the underlying technology?", a: "For in-depth education on BlockDAG consensus and GHOSTDAG mechanics, Kaspa University provides a full course library with on-chain proof of completion." },
  ];


  return (
    <div style={{ background: INK, color: PAPER, fontFamily: SANS, minHeight: "100vh", overflowX: "hidden" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(12,18,16,0.92)", backdropFilter: "blur(14px)", borderBottom: "1px solid " + LINE, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: GREEN }} />
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 20, color: PAPER }}>Kasapp ⚡</span>
        </div>
        <div className="kl-nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {NAV.map((n) => <a key={n.label} href={n.href} style={{ color: DIM, fontSize: 13.5, textDecoration: "none" }}>{n.label}</a>)}
          <a href="#waitlist" style={{ background: GREEN, color: INK, borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>Launch Pilot</a>
        </div>
        <button className="kl-mobile-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" style={{ display: "none", background: "none", border: "none", color: PAPER, fontSize: 22, cursor: "pointer" }}>{menuOpen ? "✕" : "≡"}</button>
      </nav>


      {menuOpen && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, background: SURFACE, borderBottom: "1px solid " + LINE, zIndex: 99, padding: 20 }}>
          {NAV.map((n) => <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} style={{ display: "block", color: PAPER, fontSize: 15, textDecoration: "none", padding: "12px 0", borderBottom: "1px solid " + LINE }}>{n.label}</a>)}
        </div>
      )}


      {/* HERO SECTION */}
      <section className="kl-pad" style={{ padding: "80px 24px 88px", maxWidth: 1160, margin: "0 auto" }}>
        <div className="kl-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: AMBER, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 20 }}>
              Kaspa Ambassador Pipeline · Nigeria Mainnet Beta
            </div>
            <h1 className="kl-hero-title" style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.01em", margin: "0 0 22px", color: PAPER }}>
              Kaspa micro-payments<br />as fast as you send<br />a WhatsApp message.
            </h1>
            <p style={{ color: DIM, fontSize: 16, lineHeight: 1.75, margin: "0 0 34px", maxWidth: 460 }}>
              No app downloads. No exchange KYC delays. Text <b>Hi</b> to auto-generate a self-custodial wallet, send KAS to any phone number, and settle daily utility bills in 3 seconds.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a href="#waitlist" style={{ background: GREEN, color: INK, borderRadius: 8, padding: "13px 24px", fontSize: 14.5, fontWeight: 600, textDecoration: "none" }}>Join 300-User Pilot</a>
              <a href={GITHUB} target="_blank" rel="noreferrer" style={{ background: "none", color: DIM, border: "1px solid " + LINE_STRONG, borderRadius: 8, padding: "13px 22px", fontSize: 14, fontWeight: 500, textDecoration: "none", fontFamily: MONO }}>view source</a>
            </div>
          </div>
          <div className="kl-hero-visual" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{ opacity: 0.95 }}><BlockDag /></div>
            <Conversation />
          </div>
        </div>
      </section>


      {/* PRODUCT CAPABILITIES */}
      <section id="product" className="kl-pad" style={{ padding: "0 24px 88px", maxWidth: 1160, margin: "0 auto" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: PAPER, marginBottom: 36 }}>Core Engine Capabilities</h2>
        <div className="kl-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: LINE, border: "1px solid " + LINE, borderRadius: 10, overflow: "hidden" }}>
          {CAPABILITIES.map((c, i) => (
            <div key={i} style={{ background: SURFACE, padding: "26px 22px" }}>
              <div style={{ fontFamily: SERIF, color: GREEN, fontWeight: 600, fontSize: 18, marginBottom: 12 }}>{c.t}</div>
              <div style={{ color: DIM, fontSize: 13.5, lineHeight: 1.7 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </section>


      {/* AMBASSADOR STORY */}
      <section id="story" className="kl-pad" style={{ padding: "80px 24px", background: SURFACE, borderTop: "1px solid " + LINE, borderBottom: "1px solid " + LINE }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: AMBER, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 14 }}>
            Grassroots Leadership Since 2023
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: PAPER, margin: "0 0 20px" }}>
            Bridging the Onboarding Gap in Africa
          </h2>
          <div className="kl-2col-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <p style={{ color: DIM, fontSize: 15, lineHeight: 1.8, margin: 0 }}>
              As Kaspa Ambassador for Nigeria, I have anchored campus tours across UNN, UNEC, FUNAI, and UNIABUJA, and advocated on mainstages like <b>TEDx Enugu</b>. Through hundreds of live workshops, one lesson became clear: users love Kaspa's sub-second speed, but onboarding breaks down when buying micro-amounts requires multi-tier CEX KYC or heavy withdrawal surcharges.
            </p>
            <p style={{ color: DIM, fontSize: 15, lineHeight: 1.8, margin: 0 }}>
              Africa is the world's most active organic market for real-world crypto utility, yet Africans remain an under-served class of Kaspa network participants. Kasapp removes CEX barriers by enabling instant phone-to-phone transfers, OTC voucher cash-ins, and direct bill settlements right inside WhatsApp.
            </p>
          </div>
        </div>
      </section>


      {/* METRICS */}
      <section id="metrics" className="kl-pad" style={{ padding: "88px 24px", maxWidth: 1160, margin: "0 auto" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: PAPER, marginBottom: 36 }}>Calculated Network Impact</h2>
        <div className="kl-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { metric: "300+", label: "Verified Beta Testers", sub: "UNN, UNIABUJA, FUNAI" },
            { metric: "2,500+", label: "Monthly Tx Volume", sub: "Micro-utilities & P2P sends" },
            { metric: "< $7", label: "User Acquisition Cost", sub: "vs $50-$150 ad benchmark" },
            { metric: "100%", label: "Viral Organic Loop", sub: "Auto-provisions recipient wallets" },
          ].map((m, i) => (
            <div key={i} style={{ background: SURFACE_2, border: "1px solid " + LINE_STRONG, padding: "24px 20px", borderRadius: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 28, color: GREEN, fontWeight: 600, marginBottom: 6 }}>{m.metric}</div>
              <div style={{ color: PAPER, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{m.label}</div>
              <div style={{ color: DIM, fontSize: 12 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>


      {/* SECURITY */}
      <section id="security" className="kl-pad" style={{ padding: "80px 24px", background: SURFACE, borderTop: "1px solid " + LINE, borderBottom: "1px solid " + LINE }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: AMBER, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 14 }}>
            Institutional Reserve Safety
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: PAPER, margin: "0 0 30px" }}>
            Exchange-Grade Multi-Sig & Cryptography
          </h2>
          <div className="kl-4col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <div style={{ background: SURFACE_2, padding: "24px", borderRadius: 10, border: "1px solid " + LINE }}>
              <div style={{ fontFamily: MONO, color: GREEN, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>AES-256-GCM + bcrypt</div>
              <div style={{ color: DIM, fontSize: 13.5, lineHeight: 1.7 }}>
                Mnemonics are encrypted at rest with secret server keys. Exporting seeds or updating PINs requires salted <code>bcrypt</code> authentication.
              </div>
            </div>
            <div style={{ background: SURFACE_2, padding: "24px", borderRadius: 10, border: "1px solid " + LINE }}>
              <div style={{ fontFamily: MONO, color: GREEN, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>2-of-3 Multi-Sig Vault</div>
              <div style={{ color: DIM, fontSize: 13.5, lineHeight: 1.7 }}>
                90% of system liquidity is held offline in a Kaspa Multi-Sig Cold Vault. Server hot wallet liquidity is strictly capped at operational float limits.
              </div>
            </div>
            <div style={{ background: SURFACE_2, padding: "24px", borderRadius: 10, border: "1px solid " + LINE }}>
              <div style={{ fontFamily: MONO, color: GREEN, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Atomic DB Transactions</div>
              <div style={{ color: DIM, fontSize: 13.5, lineHeight: 1.7 }}>
                MongoDB <code>$inc</code> and <code>$gte</code> updates prevent double-spend race conditions from simultaneous WhatsApp webhook bursts.
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* LEARN */}
      <section id="learn" className="kl-pad" style={{ padding: "88px 24px", maxWidth: 1160, margin: "0 auto" }}>
        <div className="kl-2col-section" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: AMBER, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 14 }}>Education Partner</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: PAPER, margin: "0 0 16px" }}>
              Kasapp gets you on the network. Kaspa University teaches you how it works.
            </h2>
            <p style={{ color: DIM, fontSize: 15, lineHeight: 1.75, margin: "0 0 24px", maxWidth: 480 }}>
              Structured courses on Kaspa fundamentals, BlockDAG consensus, and Silverscript smart contracts—complete with on-chain certificates.
            </p>
            <a href={KASPA_UNIVERSITY} target="_blank" rel="noreferrer" style={{ color: GREEN, fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: MONO }}>kaspa.university ↗</a>
          </div>
          <div style={{ background: SURFACE, border: "1px solid " + LINE_STRONG, borderRadius: 10, padding: "22px 24px" }}>
            {["BlockDAG Consensus & GHOSTDAG", "Sub-second Finality Mechanics", "Smart Contracts & Silverscript"].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < 2 ? "1px solid " + LINE : "none" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, flexShrink: 0 }} />
                <span style={{ color: DIM, fontSize: 13.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* WAITLIST */}
      <section id="waitlist" className="kl-pad" style={{ padding: "88px 24px", background: SURFACE, borderTop: "1px solid " + LINE }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div className="kl-waitlist-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center" }}>
            <div>
              <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: PAPER, margin: "0 0 10px" }}>Join the University Closed Beta</h2>
              <p style={{ color: DIM, fontSize: 15, margin: 0, maxWidth: 440 }}>Onboarding student developers and campus ambassadors across Nigeria. Reserve your slot below.</p>
            </div>
            <div style={{ minWidth: 320 }}>
              {status === "success" ? (
                <div style={{ border: "1px solid rgba(62,213,152,0.3)", background: "rgba(62,213,152,0.08)", padding: "18px 22px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: DIM, fontSize: 13 }}>Beta Pilot Queue</span>
                  <span style={{ fontFamily: MONO, fontSize: 22, color: GREEN, fontWeight: 500 }}>#{number}</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinWaitlist()} placeholder="08012345678" style={{ flex: 1, background: SURFACE_2, border: "1px solid " + LINE_STRONG, borderRadius: 7, padding: "13px 14px", color: PAPER, fontSize: 14, outline: "none", fontFamily: MONO }} />
                  <button onClick={joinWaitlist} disabled={status === "loading"} style={{ background: GREEN, color: INK, border: "none", borderRadius: 7, padding: "13px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{status === "loading" ? "…" : "Request Access"}</button>
                </div>
              )}
              {status === "error" && <div style={{ color: AMBER, fontSize: 12, marginTop: 8 }}>{number ? "Already queued — #" + number : "Something went wrong. Try again."}</div>}
            </div>
          </div>
        </div>
      </section>


      {/* FAQ */}
      <section id="faq" className="kl-pad" style={{ padding: "88px 24px", maxWidth: 780, margin: "0 auto" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: PAPER, marginBottom: 36 }}>Frequently Asked Questions</h2>
        {FAQS.map((f, i) => (
          <div key={i} style={{ borderTop: "1px solid " + LINE }}>
            <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} style={{ width: "100%", background: "none", border: "none", padding: "20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}>
              <span style={{ color: PAPER, fontWeight: 500, fontSize: 15.5 }}>{f.q}</span>
              <span style={{ fontFamily: MONO, color: DIM_2, fontSize: 18, flexShrink: 0, marginLeft: 16 }}>{openFaq === i ? "−" : "+"}</span>
            </button>
            {openFaq === i && <div style={{ color: DIM, fontSize: 14.5, lineHeight: 1.75, paddingBottom: 22, maxWidth: 640 }}>{f.a}</div>}
          </div>
        ))}
      </section>


      {/* FOOTER */}
      <footer className="kl-pad" style={{ padding: "28px 24px", borderTop: "1px solid " + LINE, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, maxWidth: 1160, margin: "0 auto" }}>
        <span style={{ fontFamily: MONO, color: DIM_2, fontSize: 12.5 }}>© 2026 Kasapp — Built on Kaspa Layer-1 by Nwafor Obinna Balor</span>
        <div style={{ display: "flex", gap: 20 }}>
          <a href={KASPA_UNIVERSITY} target="_blank" rel="noreferrer" style={{ color: DIM, fontSize: 12.5, textDecoration: "none", fontFamily: MONO }}>kaspa.university</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" style={{ color: DIM, fontSize: 12.5, textDecoration: "none", fontFamily: MONO }}>github</a>
        </div>
      </footer>
    </div>
  );
}
