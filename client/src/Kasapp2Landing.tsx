import React, { useState } from 'react';
import { 
  Menu, X, ArrowRight, Zap, Shield, MessageSquare, Clock, 
  Moon, ExternalLink, GraduationCap, Globe, Users, CheckCircle
} from 'lucide-react';
import { BlockDAGWatermark } from './components/BlockDAGAnimation';


export default function KasappLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [number, setNumber] = useState<number | null>(null);


  const API_BASE = import.meta.env.VITE_API_URL || '/api';


  const joinWaitlist = async () => {
    if (!phone.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/waitlist`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ phone }) 
      });
      const data = await res.json();
      if (res.ok) { 
        setStatus('success'); 
        setNumber(data.number); 
      } else { 
        setStatus('error'); 
        if (data.number) setNumber(data.number); 
      }
    } catch { 
      setStatus('error'); 
    }
  };


  return (
    <div className="min-h-screen bg-[#F6F8F6] text-zinc-800 font-sans relative overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-[#F6F8F6]/90 backdrop-blur-md border-b border-zinc-200/80">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
  {/* Kasapp Chat Bubble + K Vector Logo */}
  <svg 
    width="38" 
    height="38" 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    {/* Chat Bubble Background */}
    <path 
      d="M50 10C27.9086 10 10 26.1177 10 46C10 54.852 13.5186 62.9431 19.3897 69.1026L14 88L33.7226 82.2661C38.6816 84.6687 44.1834 86 50 86C72.0914 86 90 69.8823 90 50C90 30.1177 72.0914 10 50 10Z" 
      fill="#16A344"
    />
    {/* Kaspa K Arrow inside */}
    <path 
      d="M36 32V68M36 50L58 32M36 50L58 68M46 50H66" 
      stroke="white" 
      strokeWidth="7" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>


  {/* Brand Name & Tagline */}
  <div className="flex flex-col leading-none">
    <span className="text-2xl font-bold tracking-tight text-[#0F172A]">Kasapp</span>
    <span className="text-[9px] font-semibold text-[#16A344] tracking-wider uppercase mt-1">
      Money. Fast. Simple. Private.
    </span>
  </div>
</div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            <a href="#home" className="text-emerald-600 font-semibold border-b-2 border-emerald-500 pb-0.5">Home</a>
            <a href="#features" className="hover:text-emerald-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-emerald-600 transition-colors">How It Works</a>
            <a href="https://kaspa.university" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
              Kaspa University <ExternalLink size={12} />
            </a>
            <a href="#faq" className="hover:text-emerald-600 transition-colors">FAQ</a>
          </div>


          {/* Nav Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button className="text-zinc-500 hover:text-zinc-800 p-2 rounded-full">
              <Moon size={18} />
            </button>
            <a href="#waitlist" className="bg-emerald-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2 text-sm">
              Join Waitlist <ArrowRight size={15} />
            </a>
          </div>


          {/* Mobile Toggle */}
          <button className="md:hidden text-zinc-700" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>


        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-white border-b border-zinc-200 px-6 py-4 flex flex-col gap-3 shadow-lg">
            <a href="#home" onClick={() => setMenuOpen(false)} className="py-2 text-zinc-800 font-medium">Home</a>
            <a href="#features" onClick={() => setMenuOpen(false)} className="py-2 text-zinc-600">Features</a>
            <a href="https://kaspa.university" target="_blank" rel="noopener noreferrer" className="py-2 text-emerald-600 font-medium flex items-center gap-2">
              <GraduationCap size={16} /> Kaspa University
            </a>
            <a href="#waitlist" onClick={() => setMenuOpen(false)} className="py-2 text-emerald-600 font-semibold">Join Waitlist</a>
          </div>
        )}
      </header>


      {/* HERO SECTION */}
      <section id="home" className="relative pt-12 pb-20 md:pt-16 md:pb-28">
        
        {/* Animated Canvas BlockDAG Simulation in Background */}
        <div className="absolute inset-0 z-0 opacity-80">
          <BlockDAGWatermark />
        </div>


        <div className="container mx-auto px-6 relative z-10 max-w-7xl">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* LEFT COLUMN: Main Headlines & Waitlist */}
            <div className="lg:col-span-6 flex flex-col gap-6 text-left">
              
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full border border-emerald-200 text-xs font-semibold w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Built on Kaspa
                <ArrowRight size={12} />
              </div>


              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-zinc-900 leading-[1.15]">
                Money. Fast. Simple. <br />
                <span className="text-emerald-600">Private. For Everyone.</span>
              </h1>


              <p className="text-lg text-zinc-600 leading-relaxed max-w-xl">
                Kasapp brings the power of Kaspa (KAS) to your WhatsApp. Send, receive, and use KAS with simple commands — no complicated wallets, no stress.
              </p>


              {/* Action Buttons / Waitlist Form */}
              <div id="waitlist" className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="flex-1 bg-white p-1.5 rounded-2xl border border-zinc-300 shadow-sm flex items-center">
                  <input
                    type="tel"
                    placeholder="WhatsApp number..."
                    className="w-full bg-transparent px-4 py-3 outline-none text-zinc-800 placeholder:text-zinc-400 text-sm font-medium"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button
                    onClick={joinWaitlist}
                    disabled={status === 'loading' || status === 'success'}
                    className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm whitespace-nowrap disabled:opacity-50"
                  >
                    {status === 'loading' ? 'Joining...' : status === 'success' ? 'Joined!' : 'Join on WhatsApp'}
                  </button>
                </div>
              </div>


              {status === 'success' && (
                <p className="text-sm text-emerald-700 font-semibold bg-emerald-50 p-3 rounded-xl border border-emerald-200 w-fit">
                  🎉 You're in! Position #{number} on the waitlist.
                </p>
              )}


              {/* Launch Badge */}
              <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/80 p-4 rounded-2xl flex items-center justify-between max-w-sm shadow-sm mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇳🇬</span>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-sm">Launching in Nigeria First</h4>
                    <p className="text-xs text-zinc-500">Expanding across Africa soon</p>
                  </div>
                </div>
                <span className="text-xl">🌍</span>
              </div>


            </div>


            {/* CENTER/RIGHT COLUMN: Phone Mockup & Quick Cards */}
            <div className="lg:col-span-6 grid sm:grid-cols-12 gap-6 items-center">
              
              {/* WhatsApp Phone Mockup Frame */}
              <div className="sm:col-span-7 flex justify-center">
                <div className="w-[280px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl border-4 border-zinc-800">
                  <div className="bg-[#E5DDD5] rounded-[30px] overflow-hidden text-xs">
                    
                    {/* Header */}
                    <div className="bg-[#075E54] text-white p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-zinc-900">
                          ⚡
                        </div>
                        <div>
                          <p className="font-bold leading-none">Kasapp</p>
                          <p className="text-[9px] text-emerald-200 leading-none mt-0.5">online</p>
                        </div>
                      </div>
                    </div>


                    {/* Chat Messages */}
                    <div className="p-3 flex flex-col gap-2.5 min-h-[340px]">
                      
                      <div className="bg-white p-2.5 rounded-lg max-w-[85%] self-end shadow-sm">
                        <p className="font-mono text-[11px] text-zinc-800">/balance</p>
                        <span className="text-[8px] text-zinc-400 block text-right mt-0.5">9:41 AM ✓✓</span>
                      </div>


                      <div className="bg-white p-3 rounded-lg max-w-[90%] self-start shadow-sm border-l-2 border-emerald-500">
                        <p className="font-bold text-zinc-700 text-[11px]">💰 Your Kaspa Balance</p>
                        <p className="text-sm font-bold text-zinc-900 mt-1">123.456 KAS</p>
                        <p className="text-[10px] text-zinc-500">≈ ₦145,678.90 NGN</p>
                        <span className="text-[8px] text-zinc-400 block text-right mt-1">9:41 AM</span>
                      </div>


                      <div className="bg-white p-2.5 rounded-lg max-w-[85%] self-end shadow-sm">
                        <p className="font-mono text-[11px] text-zinc-800">/send 08012345678 10</p>
                        <span className="text-[8px] text-zinc-400 block text-right mt-0.5">9:42 AM ✓✓</span>
                      </div>


                      <div className="bg-[#DCF8C6] p-2.5 rounded-lg max-w-[90%] self-start shadow-sm">
                        <p className="font-bold text-emerald-900 text-[11px]">✅ Sent 10 KAS to 08012345678</p>
                        <p className="text-[9px] text-zinc-600 font-mono mt-0.5">TxID: 3f7a...8c2d</p>
                        <span className="text-[8px] text-zinc-400 block text-right mt-1">9:42 AM</span>
                      </div>


                    </div>


                  </div>
                </div>
              </div>


              {/* Quick Feature Pill List */}
              <div className="sm:col-span-5 flex flex-col gap-3">
                {[
                  { icon: MessageSquare, title: 'WhatsApp Enabled', desc: 'Use Kasapp on WhatsApp just like chatting' },
                  { icon: Zap, title: 'Instant Transactions', desc: "Powered by Kaspa's blazing-fast network" },
                  { icon: Clock, title: 'Low Fees', desc: 'Enjoy ultra-low fees on every transaction' },
                  { icon: Shield, title: 'Private & Secure', desc: 'Your keys, your money, your privacy' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-sm flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                      <item.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 text-xs">{item.title}</h4>
                      <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>


            </div>


          </div>
        </div>
      </section>


      {/* WHY KASAPP SECTION */}
      <section id="features" className="py-16 bg-white border-t border-zinc-200">
        <div className="container mx-auto px-6 max-w-6xl">
          
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-zinc-900">Why Kasapp?</h2>
            <p className="text-zinc-500 text-sm mt-2">Built for everyday people. Designed for Africa. Powered by Kaspa.</p>
          </div>


          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MessageSquare, title: 'Simple as WhatsApp', desc: 'No complex apps. Just chat and transact using easy commands.' },
              { icon: Zap, title: 'Blazing Fast', desc: 'Kaspa is one of the fastest blockchains in the world. Transactions in seconds.' },
              { icon: Clock, title: 'Low Cost', desc: 'Tiny fees mean you keep more of your money. Perfect for everyday use.' },
              { icon: Shield, title: 'Secure & Private', desc: "Built with security and privacy in mind. You're in control of your funds." },
            ].map((card, idx) => (
              <div key={idx} className="bg-[#F8FAF8] p-6 rounded-2xl border border-zinc-200/80 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <card.icon size={20} />
                </div>
                <h3 className="font-bold text-zinc-900 text-base">{card.title}</h3>
                <p className="text-zinc-600 text-xs leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>


        </div>
      </section>


      {/* DARK EMERALD BOTTOM BANNER */}
      <section className="py-10 bg-[#063b2a] text-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-800/60 text-emerald-300">
                <Users size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Built on Kaspa</h4>
                <p className="text-xs text-emerald-200/80">The fastest PoW network</p>
              </div>
            </div>


            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-800/60 text-emerald-300">
                <Globe size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">For Everyone</h4>
                <p className="text-xs text-emerald-200/80">Designed for next billion users</p>
              </div>
            </div>


            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-800/60 text-emerald-300">
                <span className="text-base">🇳🇬</span>
              </div>
              <div>
                <h4 className="font-bold text-sm">Nigeria First</h4>
                <p className="text-xs text-emerald-200/80">Launching in Nigeria, expanding soon</p>
              </div>
            </div>


            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-800/60 text-emerald-300">
                <CheckCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm">Open & Decentralized</h4>
                <p className="text-xs text-emerald-200/80">Open source & community driven</p>
              </div>
            </div>


          </div>
        </div>
      </section>


      {/* FOOTER */}
      <footer className="py-6 bg-white border-t border-zinc-200 text-center text-zinc-500 text-xs">
        <p>© 2026 Kasapp. Built for the Kaspa Ecosystem.</p>
      </footer>


    </div>
  );
}