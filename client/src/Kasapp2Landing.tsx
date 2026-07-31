import React, { useState } from 'react';
import { Menu, X, ArrowRight, Shield, Zap, MessageCircle } from 'lucide-react';
import { BlockDAGWatermark } from './components/BlockDAGAnimation';


export default function KasappLanding() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [number, setNumber] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number>(-1);


  const API_BASE = import.meta.env.VITE_API_URL || '/api';


  const joinWaitlist = async () => {
    if (!phone.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/waitlist`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ phone }) 
      });
      const data = await res.json();
      if (res.ok) { 
        setStatus("success"); 
        setNumber(data.number); 
      } else { 
        setStatus("error"); 
        if (data.number) setNumber(data.number); 
      }
    } catch { 
      setStatus("error"); 
    }
  };


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-inter relative overflow-hidden selection:bg-emerald-900 selection:text-emerald-100">
      
      {/* ---------- HEADER & NAVIGATION ---------- */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            {/* Replace /logo.svg with your actual file located in client/public/ */}
            <img src="/logo.svg" alt="Kasapp Logo" className="h-8 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            
            <div className="flex flex-col leading-none">
              <span className="font-fraunces text-2xl font-bold tracking-tight text-emerald-400">Kasapp</span>
            </div>
          </div>


          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-zinc-400">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Benefits</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</a>
            <a href="#waitlist" className="bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-full border border-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-950 transition-all font-semibold">
              Get Access
            </a>
          </div>


          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-zinc-300" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>


        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-zinc-900 border-b border-zinc-800 flex flex-col px-6 py-4 shadow-xl z-50">
            <a href="#features" onClick={() => setMenuOpen(false)} className="py-3 text-zinc-300 border-b border-zinc-800/50">Benefits</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="py-3 text-zinc-300 border-b border-zinc-800/50">FAQ</a>
            <a href="#waitlist" onClick={() => setMenuOpen(false)} className="py-3 text-emerald-400 font-semibold">Join Waitlist</a>
          </div>
        )}
      </header>


      {/* ---------- MAIN CONTENT ---------- */}
      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section id="waitlist" className="relative pt-20 pb-32 md:pt-32 md:pb-48 border-b border-zinc-900/50 flex items-center justify-center min-h-[75vh]">
          
          {/* Subtle BlockDAG Background Texture */}
          <div className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none">
            <BlockDAGWatermark />
          </div>


          <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center max-w-3xl">
            
            <div className="inline-block px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-plex text-xs font-semibold uppercase tracking-wider mb-8">
              Micro-Payments Evolved
            </div>
            
            <h1 className="font-fraunces text-5xl md:text-7xl font-bold leading-[1.1] mb-6 text-zinc-50 drop-shadow-sm">
              WhatsApp Native <br />
              <span className="text-emerald-400 italic font-medium">Kaspa Payments</span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl leading-relaxed">
              Send, receive, and manage funds instantly directly from your WhatsApp chat. No new apps, no complex seed phrases—just instant liquidity powered by BlockDAG.
            </p>


            {/* Waitlist Form */}
            <div className="w-full max-w-md bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800 backdrop-blur-sm shadow-2xl">
              <div className="flex relative">
                <input
                  type="tel"
                  placeholder="Enter your WhatsApp number..."
                  className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-600 px-6 py-4 outline-none font-medium"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={status === "loading" || status === "success"}
                />
                <button
                  onClick={joinWaitlist}
                  disabled={status === "loading" || status === "success"}
                  className="bg-emerald-500 text-zinc-950 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed m-1 whitespace-nowrap"
                >
                  {status === "loading" ? "Joining..." : status === "success" ? "Joined!" : "Join Now"}
                  {status === "idle" && <ArrowRight size={18} strokeWidth={2.5} />}
                </button>
              </div>
            </div>


            {/* Feedback Messages */}
            {status === "success" && (
              <div className="mt-6 inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-full text-emerald-400 font-medium animate-in fade-in slide-in-from-bottom-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                You're on the list! Position #{number}
              </div>
            )}
            
            {status === "error" && (
              <div className="mt-6 text-red-400 bg-red-400/10 border border-red-400/20 px-6 py-3 rounded-full font-medium">
                {number ? `You're already registered at position #${number}` : "Connection failed. Please try again."}
              </div>
            )}
          </div>
        </section>


        {/* FEATURES / BENEFITS SECTION (Streamlined) */}
        <section id="features" className="py-24 bg-zinc-950 relative z-10">
          <div className="container mx-auto px-6">
            
            <div className="text-center mb-16">
              <h2 className="font-fraunces text-3xl md:text-4xl font-semibold text-zinc-100">
                Why choose Kasapp?
              </h2>
            </div>


            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              
              <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 flex flex-col gap-5 hover:border-emerald-900/50 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <MessageCircle size={24} />
                </div>
                <h3 className="font-fraunces text-xl font-medium text-zinc-100">Native Experience</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Experience global micro-payments right within your messaging app. Pay friends, settle bills, or buy services without breaking context.
                </p>
              </div>


              <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 flex flex-col gap-5 hover:border-emerald-900/50 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <Zap size={24} />
                </div>
                <h3 className="font-fraunces text-xl font-medium text-zinc-100">Instant & Feeless</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Leverage Kaspa's revolutionary BlockDAG architecture. Micro-payments are processed instantly, with network fees so low they are practically zero.
                </p>
              </div>


              <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 flex flex-col gap-5 hover:border-emerald-900/50 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <Shield size={24} />
                </div>
                <h3 className="font-fraunces text-xl font-medium text-zinc-100">Frictionless Security</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  We abstract away the complexity of seed phrases and wallet addresses. Secure, biometric-backed infrastructure keeps your funds safe.
                </p>
              </div>


            </div>
          </div>
        </section>


        {/* FAQ SECTION */}
        <section id="faq" className="py-24 border-t border-zinc-900 bg-zinc-950">
          <div className="container mx-auto px-6 max-w-2xl">
            <h2 className="font-fraunces text-3xl font-semibold text-center mb-12">Frequently Asked Questions</h2>
            <div className="flex flex-col gap-4">
              {[
                { q: "Is Kasapp an official Kaspa product?", a: "No. Kasapp is an independent layer built to facilitate micro-payments on the Kaspa network using social infrastructure." },
                { q: "How do WhatsApp payments work?", a: "Kasapp acts as a non-custodial interface. You link your number, fund your balance, and command transactions natively via our automated chat interface." },
                { q: "When will Kasapp launch?", a: "We are currently onboarding early adopters to our waitlist. Beta invites will be sent out in phases later this quarter." }
              ].map((faq, idx) => (
                <div key={idx} className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden transition-all">
                  <button
                    className="w-full text-left px-6 py-5 flex items-center justify-between font-medium text-zinc-200"
                    onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                  >
                    {faq.q}
                    <span className="text-emerald-500 font-plex text-xl leading-none">
                      {openFaq === idx ? "−" : "+"}
                    </span>
                  </button>
                  {openFaq === idx && (
                    <div className="px-6 pb-5 text-zinc-400 text-sm leading-relaxed border-t border-zinc-800/50 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>


      {/* FOOTER */}
      <footer className="py-8 border-t border-zinc-900 text-center text-zinc-500 text-sm font-medium relative z-10 bg-zinc-950">
        <p>© 2026 Kasapp. Built for the Kaspa Ecosystem.</p>
      </footer>
    </div>
  );
}