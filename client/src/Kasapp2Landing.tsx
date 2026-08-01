import React, { useState } from 'react';
import { Menu, X, ArrowRight, Shield, Zap, MessageCircle, ExternalLink, GraduationCap } from 'lucide-react';
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
      
      {/* BACKGROUND DEPTHTEXTURE (GRID & GLOW) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(16,185,129,0.08)_0%,transparent_60%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b15_1px,transparent_1px),linear-gradient(to_bottom,#18181b15_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>


      {/* HEADER & NAVIGATION */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between relative z-10">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Kasapp Logo" className="h-8 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div className="flex flex-col leading-none">
              <span className="font-fraunces text-2xl font-bold tracking-tight text-emerald-400">Kasapp</span>
            </div>
          </div>


          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-zinc-400">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Benefits</a>
            <a href="#simulation" className="hover:text-emerald-400 transition-colors">BlockDAG</a>
            
            {/* KASPA UNIVERSITY / EDUCATION LINK */}
            <a 
              href="https://kaspa.org/learn/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1.5 text-zinc-300 hover:text-emerald-400 transition-colors font-medium bg-zinc-900/80 border border-zinc-800 px-3.5 py-1.5 rounded-full"
            >
              <GraduationCap size={16} className="text-emerald-400" />
              <span>Learn Kaspa</span>
              <ExternalLink size={12} className="text-zinc-500" />
            </a>


            <a href="#waitlist" className="bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-full border border-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-950 transition-all font-semibold">
              Get Access
            </a>
          </div>


          {/* Mobile Toggle */}
          <button className="md:hidden text-zinc-300" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>


        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-zinc-900 border-b border-zinc-800 flex flex-col px-6 py-4 shadow-xl z-50">
            <a href="#features" onClick={() => setMenuOpen(false)} className="py-3 text-zinc-300 border-b border-zinc-800/50">Benefits</a>
            <a href="#simulation" onClick={() => setMenuOpen(false)} className="py-3 text-zinc-300 border-b border-zinc-800/50">BlockDAG Tech</a>
            <a 
              href="https://kaspa.org/learn/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="py-3 text-emerald-400 font-medium flex items-center gap-2 border-b border-zinc-800/50"
            >
              <GraduationCap size={18} /> Learn Kaspa (Kaspa Org)
            </a>
            <a href="#waitlist" onClick={() => setMenuOpen(false)} className="py-3 text-emerald-400 font-semibold">Join Waitlist</a>
          </div>
        )}
      </header>


      {/* MAIN CONTENT */}
      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section id="waitlist" className="relative pt-16 pb-24 md:pt-28 md:pb-36 border-b border-zinc-900/50">
          <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center max-w-3xl">
            
            <div className="inline-block px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-plex text-xs font-semibold uppercase tracking-wider mb-8">
              Micro-Payments Evolved
            </div>
            
            <h1 className="font-fraunces text-5xl md:text-7xl font-bold leading-[1.1] mb-6 text-zinc-50">
              WhatsApp Native <br />
              <span className="text-emerald-400 italic font-medium">Kaspa Payments</span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl leading-relaxed">
              Send, receive, and manage funds instantly directly from your WhatsApp chat. No new apps, no complex seed phrases—just instant liquidity powered by BlockDAG.
            </p>


            {/* Waitlist Form */}
            <div className="w-full max-w-md bg-zinc-900/70 p-2 rounded-2xl border border-zinc-800 backdrop-blur-md shadow-2xl">
              <div className="flex relative">
                <input
                  type="tel"
                  placeholder="Enter WhatsApp number..."
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
              <div className="mt-6 inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-full text-emerald-400 font-medium">
                You're on the list! Position #{number}
              </div>
            )}
            
            {status === "error" && (
              <div className="mt-6 text-red-400 bg-red-400/10 border border-red-400/20 px-6 py-3 rounded-full font-medium">
                {number ? `Registered at position #${number}` : "Connection failed. Please try again."}
              </div>
            )}
          </div>
        </section>


        {/* RESTORED BLOCKDAG SIMULATION SECTION */}
        <section id="simulation" className="py-20 bg-zinc-950/80 border-b border-zinc-900 relative">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-10">
              <span className="text-emerald-500 font-plex text-xs uppercase tracking-widest font-semibold">Under the Hood</span>
              <h2 className="font-fraunces text-3xl md:text-4xl font-semibold text-zinc-100 mt-2">
                Powered by Kaspa's BlockDAG
              </h2>
              <p className="text-zinc-400 text-sm max-w-xl mx-auto mt-3">
                Unlike traditional single-chain blockchains, Kaspa processes blocks in parallel with 1-second confirmations.
              </p>
            </div>


            {/* Simulation Widget Card */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
              <BlockDAGWatermark />
            </div>
          </div>
        </section>


        {/* FEATURES / BENEFITS SECTION */}
        <section id="features" className="py-24 bg-zinc-950 relative z-10">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="font-fraunces text-3xl md:text-4xl font-semibold text-zinc-100">
                Why Choose Kasapp?
              </h2>
            </div>


            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 flex flex-col gap-5 hover:border-emerald-900/50 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <MessageCircle size={24} />
                </div>
                <h3 className="font-fraunces text-xl font-medium text-zinc-100">Native Experience</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Micro-payments directly within WhatsApp chats. Pay friends or vendors seamlessly without context switching.
                </p>
              </div>


              <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 flex flex-col gap-5 hover:border-emerald-900/50 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <Zap size={24} />
                </div>
                <h3 className="font-fraunces text-xl font-medium text-zinc-100">Instant & Feeless</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Transactions settle in seconds with minimal network fees, backed by Kaspa's high-throughput architecture.
                </p>
              </div>


              <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 flex flex-col gap-5 hover:border-emerald-900/50 transition-colors">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <Shield size={24} />
                </div>
                <h3 className="font-fraunces text-xl font-medium text-zinc-100">Non-Custodial Focus</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Abstracts seed phrase friction while preserving core security practices for everyday digital transfers.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* KASPA LEARNING HUB PROMO */}
        <section className="py-16 bg-emerald-950/20 border-y border-emerald-900/30">
          <div className="container mx-auto px-6 max-w-4xl flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-400 font-semibold mb-2">
                <GraduationCap size={20} />
                <span>Kaspa Education & Research</span>
              </div>
              <h3 className="font-fraunces text-2xl font-bold text-zinc-100">New to Kaspa & BlockDAG technology?</h3>
              <p className="text-zinc-400 text-sm mt-1 max-w-xl">
                Explore comprehensive guides, DAG consensus whitepapers, and ecosystem hubs to learn how Kaspa powers global micro-payments.
              </p>
            </div>
            <a 
              href="https://kaspa.org/learn/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-emerald-500 text-zinc-950 font-semibold px-6 py-3.5 rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-colors shrink-0"
            >
              <span>Explore Kaspa Hub</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </section>


        {/* FAQ SECTION */}
        <section id="faq" className="py-24 bg-zinc-950">
          <div className="container mx-auto px-6 max-w-2xl">
            <h2 className="font-fraunces text-3xl font-semibold text-center mb-12">Frequently Asked Questions</h2>
            <div className="flex flex-col gap-4">
              {[
                { q: "Is Kasapp an official Kaspa product?", a: "No. Kasapp is an independent ecosystem tool built to enable WhatsApp-native micro-payments on Kaspa." },
                { q: "How do WhatsApp payments work?", a: "You link your wallet address and issue commands directly through an automated WhatsApp chat interface." },
                { q: "When will Kasapp launch?", a: "We are onboarding initial waitlist users. Beta invites will roll out sequentially." }
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