import React, { useState } from 'react';
import { 
  Menu, X, ArrowRight, Zap, Shield, MessageSquare, Clock, 
  ExternalLink, GraduationCap, Globe, Users, CheckCircle,
  Share2, Sparkles, Copy, Check, Smartphone, Lightbulb, Tv, Wifi
} from 'lucide-react';
import { BlockDAGWatermark } from './components/BlockDAGAnimation';


export default function KasappLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [number, setNumber] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);


  const API_BASE = import.meta.env.VITE_API_URL || '/api';


  const joinWaitlist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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


  const copyInviteLink = () => {
    navigator.clipboard.writeText("https://kasapp.io");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  // --------------------------------------------------------------------------
  // PAGE VIEW 2: DEDICATED WAITLIST SUCCESS PAGE
  // --------------------------------------------------------------------------
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#F6F8F6] text-zinc-800 font-sans flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-60">
          <BlockDAGWatermark />
        </div>


        <header className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 10C27.9086 10 10 26.1177 10 46C10 54.852 13.5186 62.9431 19.3897 69.1026L14 88L33.7226 82.2661C38.6816 84.6687 44.1834 86 50 86C72.0914 86 90 69.8823 90 50C90 30.1177 72.0914 10 50 10Z" fill="#16A344"/>
              <path d="M36 32V68M36 50L58 32M36 50L58 68M46 50H66" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xl font-bold tracking-tight text-[#0F172A]">Kasapp</span>
          </div>


          <button 
            onClick={() => { setStatus('idle'); setPhone(''); }}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 underline"
          >
            ← Back to Home
          </button>
        </header>


        <main className="relative z-10 container mx-auto px-6 py-12 max-w-xl text-center">
          <div className="bg-white/90 backdrop-blur-md p-8 md:p-12 rounded-3xl border border-zinc-200/90 shadow-xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 shadow-sm animate-bounce">
              <CheckCircle size={36} />
            </div>


            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles size={14} /> You're On The List!
            </div>


            <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mb-2">
              Welcome to Kasapp ⚡
            </h1>


            <p className="text-zinc-600 text-sm mb-6 leading-relaxed">
              We've registered your WhatsApp number <strong className="text-zinc-900">{phone}</strong> for early access testing.
            </p>


            <div className="w-full bg-[#F8FAF8] border border-emerald-200 rounded-2xl p-6 mb-8 text-center">
              <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider block">Your Waitlist Position</span>
              <span className="text-4xl md:text-5xl font-black text-emerald-600 mt-1 block">
                #{number || '1'}
              </span>
              <p className="text-xs text-zinc-500 mt-2">
                We are onboarding users sequentially in Nigeria. You will receive a direct WhatsApp message when your access key goes live.
              </p>
            </div>


            <div className="w-full text-left mb-6">
              <label className="text-xs font-bold text-zinc-700 block mb-2">
                Share Kasapp with friends:
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value="https://kasapp.io" 
                  className="flex-1 bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-600 outline-none"
                />
                <button 
                  onClick={copyInviteLink}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>


            <div className="w-full flex flex-col gap-3">
              <a 
                href="https://kaspa.university" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-full py-3 px-4 bg-zinc-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
              >
                <GraduationCap size={16} />
                Learn GHOSTDAG at Kaspa University
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </main>


        <footer className="relative z-10 py-6 text-center text-xs text-zinc-400">
          © 2026 Kasapp. Built for the Kaspa Ecosystem.
        </footer>
      </div>
    );
  }


  // --------------------------------------------------------------------------
  // PAGE VIEW 1: LANDING PAGE (DEFAULT)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F6F8F6] text-zinc-800 font-sans relative overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-[#F6F8F6]/90 backdrop-blur-md border-b border-zinc-200/80">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* BRAND LOGO */}
          <div className="flex items-center gap-3">
            <svg 
              width="38" 
              height="38" 
              viewBox="0 0 100 100" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
            >
              <path 
                d="M50 10C27.9086 10 10 26.1177 10 46C10 54.852 13.5186 62.9431 19.3897 69.1026L14 88L33.7226 82.2661C38.6816 84.6687 44.1834 86 50 86C72.0914 86 90 69.8823 90 50C90 30.1177 72.0914 10 50 10Z" 
                fill="#16A344"
              />
              <path 
                d="M36 32V68M36 50L58 32M36 50L58 68M46 50H66" 
                stroke="white" 
                strokeWidth="7" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>


            <div className="flex flex-col leading-none">
              <span className="text-2xl font-bold tracking-tight text-[#0F172A]">Kasapp</span>
              <span className="text-[9px] font-semibold text-[#16A344] tracking-wider uppercase mt-1">
                Money. Fast. Simple. Private.
              </span>
            </div>
          </div>


          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            <a href="#home" className="text-emerald-600 font-semibold border-b-2 border-emerald-500 pb-0.5">Home</a>
            <a href="#utilities" className="hover:text-emerald-600 transition-colors">Utilities</a>
            <a href="#features" className="hover:text-emerald-600 transition-colors">Why Kasapp</a>
            <a href="https://kaspa.university" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
              Kaspa University <ExternalLink size={12} />
            </a>
          </div>


          <div className="hidden md:flex items-center gap-4">
            <a href="#waitlist" className="bg-emerald-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2 text-sm">
              Join Waitlist <ArrowRight size={15} />
            </a>
          </div>


          <button className="md:hidden text-zinc-700" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>


        {menuOpen && (
          <div className="md:hidden bg-white border-b border-zinc-200 px-6 py-4 flex flex-col gap-3 shadow-lg">
            <a href="#home" onClick={() => setMenuOpen(false)} className="py-2 text-zinc-800 font-medium">Home</a>
            <a href="#utilities" onClick={() => setMenuOpen(false)} className="py-2 text-zinc-600">Utilities</a>
            <a href="#features" onClick={() => setMenuOpen(false)} className="py-2 text-zinc-600">Why Kasapp</a>
            <a href="https://kaspa.university" target="_blank" rel="noopener noreferrer" className="py-2 text-emerald-600 font-medium flex items-center gap-2">
              <GraduationCap size={16} /> Kaspa University
            </a>
            <a href="#waitlist" onClick={() => setMenuOpen(false)} className="py-2 text-emerald-600 font-semibold">Join Waitlist</a>
          </div>
        )}
      </header>


      {/* HERO SECTION */}
      <section id="home" className="relative pt-12 pb-20 md:pt-16 md:pb-28">
        <div className="absolute inset-0 z-0 opacity-80">
          <BlockDAGWatermark />
        </div>


        <div className="container mx-auto px-6 relative z-10 max-w-7xl">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-6 flex flex-col gap-6 text-left">
              
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full border border-emerald-200 text-xs font-semibold w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                WhatsApp Utility Layer on Kaspa
                <ArrowRight size={12} />
              </div>


              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-zinc-900 leading-[1.15]">
                Pay Bills, Buy Data & Send Money. <br />
                <span className="text-emerald-600">Right on WhatsApp.</span>
              </h1>


              <p className="text-lg text-zinc-600 leading-relaxed max-w-xl">
                Kasapp turns WhatsApp into your financial hub powered by Kaspa (KAS). Recharge airtime, buy data bundles, pay electricity bills, and send instant peer-to-peer payments using simple chat commands.
              </p>


              {/* Waitlist Form */}
              <form id="waitlist" onSubmit={joinWaitlist} className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="flex-1 bg-white p-1.5 rounded-2xl border border-zinc-300 shadow-sm flex items-center">
                  <input
                    type="tel"
                    required
                    placeholder="WhatsApp number..."
                    className="w-full bg-transparent px-4 py-3 outline-none text-zinc-800 placeholder:text-zinc-400 text-sm font-medium"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm whitespace-nowrap disabled:opacity-50"
                  >
                    {status === 'loading' ? 'Joining...' : 'Join on WhatsApp'}
                  </button>
                </div>
              </form>


              {status === 'error' && (
                <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {number ? `You are already registered at position #${number}` : 'Something went wrong. Please try again.'}
                </p>
              )}


              {/* Launch Badge */}
              <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/80 p-4 rounded-2xl flex items-center justify-between max-w-sm shadow-sm mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇳🇬</span>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-sm">Launching in Nigeria First</h4>
                    <p className="text-xs text-zinc-500">Airtime, Data, Electricity & P2P</p>
                  </div>
                </div>
                <span className="text-xl">⚡</span>
              </div>


            </div>


            {/* RIGHT COLUMN: WhatsApp Mockup with Utility Commands */}
            <div className="lg:col-span-6 grid sm:grid-cols-12 gap-6 items-center">
              
              <div className="sm:col-span-7 flex justify-center">
                <div className="w-[285px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl border-4 border-zinc-800">
                  <div className="bg-[#E5DDD5] rounded-[30px] overflow-hidden text-xs">
                    
                    <div className="bg-[#075E54] text-white p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-zinc-900">
                          ⚡
                        </div>
                        <div>
                          <p className="font-bold leading-none">Kasapp Bot</p>
                          <p className="text-[9px] text-emerald-200 leading-none mt-0.5">online</p>
                        </div>
                      </div>
                    </div>


                    <div className="p-3 flex flex-col gap-2.5 min-h-[350px]">
                      
                      {/* Airtime Purchase Command */}
                      <div className="bg-white p-2 rounded-lg max-w-[85%] self-end shadow-sm">
                        <p className="font-mono text-[10px] text-zinc-800">/airtime MTN 08012345678 1000</p>
                        <span className="text-[7px] text-zinc-400 block text-right mt-0.5">9:41 AM ✓✓</span>
                      </div>


                      <div className="bg-[#DCF8C6] p-2 rounded-lg max-w-[90%] self-start shadow-sm border-l-2 border-emerald-600">
                        <p className="font-bold text-emerald-900 text-[10px]">📱 Airtime Purchase Successful</p>
                        <p className="text-[9px] text-zinc-700 mt-0.5">₦1,000 MTN sent to 08012345678</p>
                        <p className="text-[8px] text-zinc-500 font-mono mt-0.5">Paid: 3.42 KAS</p>
                        <span className="text-[7px] text-zinc-400 block text-right">9:41 AM</span>
                      </div>


                      {/* Electricity Bill Command */}
                      <div className="bg-white p-2 rounded-lg max-w-[85%] self-end shadow-sm">
                        <p className="font-mono text-[10px] text-zinc-800">/bill IKEDC 0123456789 5000</p>
                        <span className="text-[7px] text-zinc-400 block text-right mt-0.5">9:42 AM ✓✓</span>
                      </div>


                      <div className="bg-white p-2.5 rounded-lg max-w-[90%] self-start shadow-sm">
                        <p className="font-bold text-zinc-800 text-[10px]">💡 Token: 4821-9012-3491-0182</p>
                        <p className="text-[9px] text-zinc-600">IKEDC Prepaid • ₦5,000</p>
                        <span className="text-[7px] text-zinc-400 block text-right mt-1">9:42 AM</span>
                      </div>


                    </div>


                  </div>
                </div>
              </div>


              {/* Utility Highlight Column */}
              <div className="sm:col-span-5 flex flex-col gap-3">
                {[
                  { icon: Smartphone, title: 'Airtime & Data', desc: 'MTN, Airtel, Glo, 9mobile' },
                  { icon: Lightbulb, title: 'Electricity Bills', desc: 'IKEDC, EKEDC, AEDC & more' },
                  { icon: Tv, title: 'Cable TV Subscriptions', desc: 'DSTV, GOTV, Startimes' },
                  { icon: Zap, title: 'P2P Kaspa Transfer', desc: 'Send KAS instantly by phone number' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-sm flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                      <item.icon size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 text-xs">{item.title}</h4>
                      <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>


            </div>


          </div>
        </div>
      </section>


      {/* CORE UTILITIES SHOWCASE SECTION */}
      <section id="utilities" className="py-16 bg-white border-t border-zinc-200">
        <div className="container mx-auto px-6 max-w-6xl">
          
          <div className="text-center mb-12">
            <span className="text-emerald-600 font-semibold text-xs uppercase tracking-widest block">Everyday Utility</span>
            <h2 className="text-3xl font-extrabold text-zinc-900 mt-1">Everything You Can Do on Kasapp</h2>
            <p className="text-zinc-500 text-sm mt-2 max-w-xl mx-auto">
              No complex DeFi menus or cumbersome exchange apps. Just message Kasapp on WhatsApp to settle everyday bills.
            </p>
          </div>


          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-[#F8FAF8] p-6 rounded-2xl border border-zinc-200/80 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 text-base">Airtime & Data</h3>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Top up your phone or send mobile data directly to family members on any major Nigerian network.
              </p>
            </div>


            <div className="bg-[#F8FAF8] p-6 rounded-2xl border border-zinc-200/80 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Lightbulb size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 text-base">Power & Electricity</h3>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Generate prepaid electricity meter tokens instantly without visiting a vendor or opening banking apps.
              </p>
            </div>


            <div className="bg-[#F8FAF8] p-6 rounded-2xl border border-zinc-200/80 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Tv size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 text-base">Cable TV</h3>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Renew DSTV, GOTV, and Startimes packages in seconds with simple WhatsApp chat commands.
              </p>
            </div>


            <div className="bg-[#F8FAF8] p-6 rounded-2xl border border-zinc-200/80 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Zap size={20} />
              </div>
              <h3 className="font-bold text-zinc-900 text-base">Instant KAS Transfers</h3>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Send KAS to any WhatsApp contact or phone number with 1-second BlockDAG settlement speeds.
              </p>
            </div>


          </div>


        </div>
      </section>


      {/* WHY KASAPP SECTION */}
      <section id="features" className="py-16 bg-[#F6F8F6] border-t border-zinc-200">
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
              <div key={idx} className="bg-white p-6 rounded-2xl border border-zinc-200/80 flex flex-col gap-3">
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


      {/* FOOTER */}
      <footer className="py-6 bg-white border-t border-zinc-200 text-center text-zinc-500 text-xs">
        <p>© 2026 Kasapp. Built for the Kaspa Ecosystem.</p>
      </footer>


    </div>
  );
}