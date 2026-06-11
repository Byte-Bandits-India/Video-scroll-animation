import { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import {
  ChevronDown,
  Infinity,
  Menu,
  X,
  Compass,
  Moon,
  Zap,
  Activity,
  ArrowRight,
  Sparkles,
  ArrowDown,
  Heart,
  Clock,
  BrainCircuit,
  Lock,
  Globe
} from 'lucide-react';

const TOTAL_FRAMES = 193;
const BATCH_SIZE = 20;

// Routine Planner Database
const ROUTINES = {
  morning: {
    title: 'Rise & Align',
    time: '6:00 AM – 9:00 AM',
    colorClass: 'text-gradient-gold',
    items: [
      { activity: 'Deep Breathwork', duration: '10 min', desc: 'Calm the nervous system and oxygenate cells.' },
      { activity: 'Hydration Reset', duration: '5 min', desc: 'Drink 500ml of mineral-infused water.' },
      { activity: 'Circadian Light Exposure', duration: '15 min', desc: 'Step outside to anchor your cortisol cycle.' }
    ]
  },
  afternoon: {
    title: 'Focus & Flow',
    time: '12:00 PM – 3:00 PM',
    colorClass: 'text-gradient-green-blue',
    items: [
      { activity: 'Somatic Reset & Stretch', duration: '8 min', desc: 'Release physical tension from sitting.' },
      { activity: 'Cognitive Offload', duration: '5 min', desc: 'Clear task residue before deep focus.' },
      { activity: 'Nutrient-Dense Lunch', duration: '30 min', desc: 'Low-glycemic fuel to avoid afternoon slumps.' }
    ]
  },
  evening: {
    title: 'Decompress & Reflect',
    time: '6:00 PM – 9:00 PM',
    colorClass: 'text-gradient-purple-blue',
    items: [
      { activity: 'Digital Sunset', duration: '20 min', desc: 'Shift all personal screens to warm amber tones.' },
      { activity: 'Gratitude Reflection', duration: '10 min', desc: 'List three positive moments from the day.' },
      { activity: 'Somatic Release Ritual', duration: '15 min', desc: 'Light yoga and breathing to transition to sleep.' }
    ]
  },
  night: {
    title: 'Deep Recovery',
    time: '10:00 PM – 5:00 AM',
    colorClass: 'text-gradient-purple-blue',
    items: [
      { activity: 'Darkness Sanctuary', duration: 'Ongoing', desc: 'Ensure absolute blackout environment.' },
      { activity: 'Circadian Cooldown', duration: 'Ongoing', desc: 'Set room temperature to a cool 18°C.' },
      { activity: 'Thermal Transition', duration: '20 min', desc: 'Warm bath or shower to drop core temperature.' }
    ]
  }
};

const navLinks = [
  { label: 'Home', active: true },
  { label: 'Wellness Space' },
  { label: 'Routine Engine' },
  { label: 'Our Experts' },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Loader States
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [loaderOpacity, setLoaderOpacity] = useState(1);
  const [showLoader, setShowLoader] = useState(true);

  // Scroll / Canvas States
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollProgressRef = useRef(0);
  const currentFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  
  const runwayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interactive UI States
  const [activePlannerTab, setActivePlannerTab] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // Initialize Lenis Smooth Scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 1.5,
      infinite: false,
    });

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // 1. Batch Frame Preloading System
  useEffect(() => {
    let active = true;

    const loadAllFrames = async () => {
      const loadedImages: HTMLImageElement[] = [];

      const loadFrame = (index: number): Promise<HTMLImageElement> => {
        return new Promise((resolve) => {
          const img = new Image();
          const frameNum = String(index).padStart(4, '0');
          img.src = `/frames/frame-${frameNum}.webp`;
          img.onload = () => resolve(img);
          img.onerror = () => {
            console.error(`Failed to load frame ${frameNum}`);
            // Resolve with empty image to avoid hanging loader on connection drop
            resolve(img);
          };
        });
      };

      // Batch load frames in groups of BATCH_SIZE (20) to prevent request starvation
      for (let i = 1; i <= TOTAL_FRAMES; i += BATCH_SIZE) {
        if (!active) return;
        const batch: Promise<HTMLImageElement>[] = [];
        const end = Math.min(i + BATCH_SIZE - 1, TOTAL_FRAMES);

        for (let j = i; j <= end; j++) {
          batch.push(loadFrame(j));
        }

        const results = await Promise.all(batch);
        loadedImages.push(...results);

        if (active) {
          setLoadedCount((prev) => Math.min(prev + results.length, TOTAL_FRAMES));
        }
      }

      if (active) {
        imagesRef.current = loadedImages;
        // Let user see 100% complete for a moment
        setTimeout(() => {
          setLoaderOpacity(0);
          setTimeout(() => {
            setLoadingComplete(true);
            setShowLoader(false);
          }, 800);
        }, 500);
      }
    };

    loadAllFrames();

    return () => {
      active = false;
    };
  }, []);

  // 2. Passive Scroll Listener
  useEffect(() => {
    if (!loadingComplete) return;

    const handleScroll = () => {
      if (!runwayRef.current) return;
      const rect = runwayRef.current.getBoundingClientRect();
      
      // Calculate progress across the scroll runway
      const progress = -rect.top / (rect.height - window.innerHeight);
      const normalized = Math.max(0, Math.min(1, progress));

      scrollProgressRef.current = normalized;
      setScrollProgress(normalized);

      // Map scroll progress to frame index
      const frameIndex = Math.min(
        Math.floor(normalized * (TOTAL_FRAMES - 1)),
        TOTAL_FRAMES - 1
      );
      currentFrameRef.current = frameIndex;
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [loadingComplete]);

  // 3. requestAnimationFrame (rAF) Render Loop
  useEffect(() => {
    if (!loadingComplete) return;

    let rAFId: number;

    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rAFId = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext('2d');
      const images = imagesRef.current;
      const currentFrame = currentFrameRef.current;

      if (ctx && images[currentFrame] && currentFrame !== drawnFrameRef.current) {
        const img = images[currentFrame];
        
        // Match canvas dimensions to the image source dimensions for maximum resolution
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawnFrameRef.current = currentFrame;

        // Apply smooth scale and rotation based on scroll progress (GPU accelerated)
        const progress = scrollProgressRef.current;
        const rotation = -3.5 + progress * 9.5; // subtle rotation sweep (-3.5deg to +6deg)
        const scale = 1.05 - progress * 0.05;   // zoom from 1.05 to 1.0
        canvas.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
      }

      rAFId = requestAnimationFrame(tick);
    };

    rAFId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rAFId);
    };
  }, [loadingComplete]);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim() !== '') {
      setNewsletterSubscribed(true);
      setNewsletterEmail('');
    }
  };

  const currentRoutine = ROUTINES[activePlannerTab];

  return (
    <div className="w-full min-h-screen bg-[#06070b]">
      {/* 1. PRELOADER SCREEN */}
      {showLoader && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#06070b] transition-opacity duration-700"
          style={{ opacity: loaderOpacity }}
        >
          <div className="flex flex-col items-center w-full max-w-md px-8 text-center">
            <Infinity size={48} className="text-emerald-500 animate-pulse mb-6" strokeWidth={1.5} />
            <h2 className="text-white text-2xl sm:text-3xl font-medium tracking-tight mb-2">
              Preparing Your Sanctuary
            </h2>
            <p className="text-white/40 text-xs sm:text-sm leading-relaxed mb-6">
              Aligning routines, insights, and expert advisors for your personalized wellness journey.
            </p>
            
            {/* Progress Bar Container */}
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(loadedCount / TOTAL_FRAMES) * 100}%` }}
              />
            </div>
            
            {/* Loading text percentage */}
            <span className="text-emerald-400 font-mono text-sm font-medium">
              {Math.round((loadedCount / TOTAL_FRAMES) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* 2. SCROLL PROGRESS INDICATOR */}
      {loadingComplete && (
        <div className="fixed top-0 left-0 right-0 h-1 z-50">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500 transition-all duration-100 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
      )}

      {/* 3. FLOATING NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 sm:px-12 py-5 bg-gradient-to-b from-[#06070b]/80 to-transparent backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 text-white font-medium text-lg cursor-pointer">
          <Infinity size={26} className="text-emerald-500" strokeWidth={1.5} />
          <span className="tracking-tight font-semibold">Equilibrium</span>
        </div>

        {/* Navigation pill */}
        <div className="hidden md:flex liquid-glass items-center gap-1 rounded-full px-2 py-1.5">
          {navLinks.map((link) => (
            <button
              key={link.label}
              className={
                'px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-300 ' +
                (link.active
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5')
              }
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* CTAs (desktop) */}
        <div className="hidden md:flex items-center gap-4">
          <button className="text-white/80 hover:text-white text-xs font-semibold tracking-wide transition-colors">
            Log in
          </button>
          <button className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-300">
            Begin Now
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden liquid-glass text-white p-2 rounded-full"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-x-4 top-[76px] z-40 md:hidden liquid-glass-premium rounded-3xl p-6 flex flex-col gap-2">
          {navLinks.map((link) => (
            <button
              key={link.label}
              className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-all"
            >
              <span>{link.label}</span>
              <ChevronDown size={14} className="text-white/40" />
            </button>
          ))}
          <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
            <button className="flex-1 liquid-glass text-white text-xs font-semibold py-3 rounded-full hover:bg-white/5 transition-colors">
              Log in
            </button>
            <button className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-semibold py-3 rounded-full transition-all">
              Begin Now
            </button>
          </div>
        </div>
      )}

      {/* 4. SCROLL CONTAINER RUNWAY */}
      <div ref={runwayRef} className="relative w-full h-[400vh]">
        {/* Sticky Wrapper */}
        <div className="sticky top-0 w-full h-screen overflow-hidden bg-[#06070b]">
          {/* Canvas Rendering Box */}
          <canvas
            ref={canvasRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-screen h-screen object-cover canvas-mask"
          />

          {/* Floating starting badges */}
          <div className={`absolute top-28 left-6 sm:left-12 lg:left-24 hidden md:flex items-center gap-2 liquid-glass px-4 py-2.5 rounded-full border border-white/5 text-xs text-white/80 transition-all duration-700 ${scrollProgress >= 0.00 && scrollProgress <= 0.22 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-medium">Evidence-Based Methodology</span>
          </div>

          <div className={`absolute top-28 right-6 sm:right-12 lg:right-24 hidden md:flex items-center gap-2 liquid-glass px-4 py-2.5 rounded-full border border-white/5 text-xs text-white/80 transition-all duration-700 ${scrollProgress >= 0.00 && scrollProgress <= 0.22 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <Globe size={12} className="text-cyan-400" />
            <span className="font-medium">100% Privacy-Encrypted Logs</span>
          </div>

          {/* Active Overlay: Phase 1 (Intro) */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-end pb-24 md:pb-28 px-6 text-center scroll-phase-card ${
              scrollProgress >= 0.00 && scrollProgress <= 0.22 ? 'visible' : ''
            }`}
          >
            <div className="max-w-2xl bg-black/25 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/5">
              <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-emerald-400 text-[10px] font-semibold tracking-wider uppercase mb-4">
                <Sparkles size={10} /> Introducing Equilibrium
              </span>
              <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight leading-tight mb-4">
                Live Better, Feel Whole Every Day
              </h1>
              <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-lg mx-auto mb-6">
                Take charge of how you feel with a companion built for your journey—build routines, track your growth, and unlock tailored insights.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href="#wellness-hub"
                  className="bg-white text-black text-xs sm:text-sm font-semibold px-6 py-3 rounded-full hover:bg-white/90 transition-colors cursor-pointer"
                >
                  Explore Pillars
                </a>
                <a
                  href="#daily-planner"
                  className="liquid-glass text-white text-xs sm:text-sm font-semibold px-6 py-3 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                >
                  View Planner
                </a>
              </div>

              {/* Pillars column grid details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5 text-left">
                <div>
                  <span className="text-emerald-400 text-xs font-semibold block">01. Circadian Sync</span>
                  <span className="text-white/40 text-[10px] block mt-0.5">Align with biological light cycles.</span>
                </div>
                <div>
                  <span className="text-violet-400 text-xs font-semibold block">02. Somatic Habits</span>
                  <span className="text-white/40 text-[10px] block mt-0.5">Evidence-based daily routines.</span>
                </div>
                <div>
                  <span className="text-cyan-400 text-xs font-semibold block">03. Neural Logs</span>
                  <span className="text-white/40 text-[10px] block mt-0.5">Secure, non-invasive metrics.</span>
                </div>
              </div>
            </div>
            {/* Scroll Assist Hint */}
            <div className="absolute bottom-6 flex flex-col items-center gap-1 text-white/40 text-[10px] uppercase tracking-widest animate-bounce">
              <span>Scroll down to enter</span>
              <ArrowDown size={12} className="text-emerald-500" />
            </div>
          </div>

          {/* Active Overlay: Phase 2 (Mindful Routines) */}
          <div
            className={`absolute inset-0 flex items-center justify-center md:justify-start px-6 md:pl-24 lg:pl-32 scroll-phase-card ${
              scrollProgress >= 0.26 && scrollProgress <= 0.45 ? 'visible' : ''
            }`}
          >
            <div className="w-full max-w-md liquid-glass-premium rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
              <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2xl w-fit mb-5">
                <Compass size={22} />
              </div>
              <h2 className="text-white text-2xl sm:text-3xl font-medium tracking-tight mb-3">
                Mindful Routines: <br/>
                <span className="text-gradient-green-blue">Consistency Redefined</span>
              </h2>
              <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
                Consistency builds lifestyle change. Cultivate wellness pathways through custom routines designed to match your body's circadian clock, lowering stress levels and boosting output.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2.5 text-xs text-white/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span>Somatic timers to anchor behavior paths</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-white/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span>Habit chains built on daily science principles</span>
                </li>
              </ul>
              <a
                href="#daily-planner"
                className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold hover:text-emerald-300 transition-colors"
              >
                Launch the Interactive Planner <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Active Overlay: Phase 3 (Growth Analytics) */}
          <div
            className={`absolute inset-0 flex items-center justify-center md:justify-end px-6 md:pr-24 lg:pr-32 scroll-phase-card ${
              scrollProgress >= 0.50 && scrollProgress <= 0.68 ? 'visible' : ''
            }`}
          >
            <div className="w-full max-w-md liquid-glass-premium rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
              <div className="bg-violet-500/10 text-violet-400 p-3 rounded-2xl w-fit mb-5">
                <Activity size={22} />
              </div>
              <h2 className="text-white text-2xl sm:text-3xl font-medium tracking-tight mb-3">
                Growth Analytics: <br/>
                <span className="text-gradient-purple-blue">Visualize Progress</span>
              </h2>
              <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
                Understand the shifts in your baseline well-being. Our analytical dashboard tracks mood indexes, heart rate variability patterns, and circadian alignment metrics to present clear recovery insights.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div>
                  <span className="text-white/40 text-[9px] uppercase tracking-wider block">Stress Index</span>
                  <span className="text-violet-400 text-base font-semibold">-34% Average</span>
                </div>
                <div>
                  <span className="text-white/40 text-[9px] uppercase tracking-wider block">Sleep Stability</span>
                  <span className="text-emerald-400 text-base font-semibold">+41% Increase</span>
                </div>
              </div>
              <a
                href="#wellness-hub"
                className="inline-flex items-center gap-1.5 text-violet-400 text-xs font-semibold hover:text-violet-300 transition-colors"
              >
                Browse Wellness Pillars <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Active Overlay: Phase 4 (Tailored Insights) */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center scroll-phase-card ${
              scrollProgress >= 0.74 && scrollProgress <= 0.94 ? 'visible' : ''
            }`}
          >
            <div className="w-full max-w-xl liquid-glass-premium rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl">
              <div className="bg-cyan-500/10 text-cyan-400 p-3 rounded-2xl w-fit mx-auto mb-5">
                <BrainCircuit size={24} />
              </div>
              <h2 className="text-white text-3xl md:text-4xl font-medium tracking-tight mb-4">
                Personalized Insights: <br/>
                <span className="text-gradient-green-blue">Driven by Circadian Science</span>
              </h2>
              <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-md mx-auto">
                No generic programs. Equilibrium leverages medical research and behavioral logs to give you actionable triggers exactly when your body is primed for them.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-bold px-7 py-3.5 rounded-full hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all">
                  Begin Free Evaluation
                </button>
                <a
                  href="#advisory-board"
                  className="w-full sm:w-auto liquid-glass text-white text-xs font-semibold px-7 py-3.5 rounded-full hover:bg-white/5 transition-colors"
                >
                  Meet Our Scientists
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SECTION A: WELLNESS HUB */}
      <section id="wellness-hub" className="relative py-24 md:py-32 bg-[#06070b]">
        {/* Background ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="section-container relative z-10">
          {/* Header */}
          <div className="max-w-xl mb-16 md:mb-20">
            <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase block mb-3">
              Comprehensive Growth
            </span>
            <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight mb-4">
              Explore Our Core Wellness Pillars
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              We focus on four foundational pillars to balance daily biological rhythms, creating a sustainable foundation for growth.
            </p>
          </div>

          {/* Grid layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Card 1: Mindfulness */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover-glow transition-all duration-500 border border-white/5 group">
              <div>
                <div className="overflow-hidden rounded-2xl mb-6 relative aspect-video">
                  <img
                    src="/images/wellness_mindfulness.png"
                    alt="Mindfulness"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <Compass size={13} className="text-emerald-400" />
                    <span className="text-[10px] text-white/90 font-medium tracking-wide">MINDFULNESS</span>
                  </div>
                </div>
                <h3 className="text-white text-xl font-semibold mb-3 group-hover:text-emerald-400 transition-colors">
                  Mindfulness Space
                </h3>
                <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
                  Lower emotional reactivity and clear psychological noise. Access scientifically evaluated auditory environments, guided breathing sessions, and localized muscle release protocols designed to calm the nervous system.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-auto">
                <span className="text-white/40 text-[11px] font-medium">12 Guided Modules</span>
                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 group-hover:underline">
                  Launch Space <ArrowRight size={12} />
                </span>
              </div>
            </div>

            {/* Card 2: Sleep Recovery */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover-glow-purple transition-all duration-500 border border-white/5 group">
              <div>
                <div className="overflow-hidden rounded-2xl mb-6 relative aspect-video">
                  <img
                    src="/images/wellness_sleep.png"
                    alt="Sleep Recovery"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <Moon size={13} className="text-violet-400" />
                    <span className="text-[10px] text-white/90 font-medium tracking-wide">SLEEP RECOVERY</span>
                  </div>
                </div>
                <h3 className="text-white text-xl font-semibold mb-3 group-hover:text-violet-400 transition-colors">
                  Nightly Sleep Sync
                </h3>
                <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
                  Optimized rest is essential for cellular rejuvenation. Align your evening routines to prompt natural melatonin release, adjust bedroom environments, and log structural markers for deeper, restorative sleep cycles.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-auto">
                <span className="text-white/40 text-[11px] font-medium">Circadian Automations</span>
                <span className="text-violet-400 text-xs font-bold flex items-center gap-1 group-hover:underline">
                  Review Sleep Hub <ArrowRight size={12} />
                </span>
              </div>
            </div>

            {/* Card 3: Movement */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover-glow transition-all duration-500 border border-white/5 group">
              <div>
                <div className="overflow-hidden rounded-2xl mb-6 relative aspect-video">
                  <img
                    src="/images/wellness_movement.png"
                    alt="Movement & Flow"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <Zap size={13} className="text-emerald-400" />
                    <span className="text-[10px] text-white/90 font-medium tracking-wide">PHYSICAL MOVEMENT</span>
                  </div>
                </div>
                <h3 className="text-white text-xl font-semibold mb-3 group-hover:text-emerald-400 transition-colors">
                  Flow State Movement
                </h3>
                <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
                  Exercise mapped to your body's energy timelines. Discover dynamic movement practices and low-impact somatic releases designed to optimize physical output while limiting elevated inflammatory cortisol spikes.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-auto">
                <span className="text-white/40 text-[11px] font-medium">Tailored Routines</span>
                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 group-hover:underline">
                  Access Movements <ArrowRight size={12} />
                </span>
              </div>
            </div>

            {/* Card 4: Clean Nutrition */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover-glow-purple transition-all duration-500 border border-white/5 group">
              <div>
                <div className="overflow-hidden rounded-2xl mb-6 relative aspect-video">
                  <img
                    src="/images/wellness_nutrition.png"
                    alt="Nutrition"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <Heart size={13} className="text-violet-400" />
                    <span className="text-[10px] text-white/90 font-medium tracking-wide">CLEAN NUTRITION</span>
                  </div>
                </div>
                <h3 className="text-white text-xl font-semibold mb-3 group-hover:text-violet-400 transition-colors">
                  Mindful Nutrition
                </h3>
                <p className="text-white/60 text-xs sm:text-sm leading-relaxed mb-6">
                  Fuel your cells correctly. Discover dietary principles designed to limit blood sugar volatility, manage cognitive fatigue, and enhance metabolic efficiency based on simple biological cycles.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-auto">
                <span className="text-white/40 text-[11px] font-medium">Custom Fuel Library</span>
                <span className="text-violet-400 text-xs font-bold flex items-center gap-1 group-hover:underline">
                  Open Nutrition Library <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION B: DAILY ROUTINE PLANNER */}
      <section id="daily-planner" className="relative py-24 md:py-32 bg-[#0c0e17] border-y border-white/5">
        <div className="section-container">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase block mb-3">
              Interactive Blueprint
            </span>
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              Your Daily Circadian Engine
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Explore how routine blocks change across the day. Click on each phase below to inspect recommended habits and physiological impacts.
            </p>
          </div>

          {/* Interactive Planner Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Tabs (Left Column) */}
            <div className="lg:col-span-4 flex flex-row lg:flex-col gap-3 overflow-x-auto pb-4 lg:pb-0 scrollbar-none">
              {(['morning', 'afternoon', 'evening', 'night'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActivePlannerTab(tab)}
                  className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 rounded-2xl text-left border transition-all duration-300 w-auto lg:w-full ${
                    activePlannerTab === tab
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white shadow-lg shadow-emerald-500/5'
                      : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${activePlannerTab === tab ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
                    {tab === 'morning' && <Clock size={16} />}
                    {tab === 'afternoon' && <Zap size={16} />}
                    {tab === 'evening' && <Compass size={16} />}
                    {tab === 'night' && <Moon size={16} />}
                  </div>
                  <div>
                    <span className="text-xs font-semibold block capitalize">{tab} Block</span>
                    <span className="text-[10px] text-white/40 font-mono">
                      {tab === 'morning' && '06:00 – 09:00'}
                      {tab === 'afternoon' && '12:00 – 15:00'}
                      {tab === 'evening' && '18:00 – 21:00'}
                      {tab === 'night' && '22:00 – 05:00'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Display Area (Right Column) */}
            <div className="lg:col-span-8 liquid-glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative min-h-[380px] flex flex-col justify-between transition-all duration-500">
              <div>
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5 mb-6">
                  <div>
                    <span className="text-white/40 text-[10px] uppercase font-mono tracking-wider">Active Segment</span>
                    <h3 className={`text-2xl font-bold tracking-tight ${currentRoutine.colorClass} mt-1`}>
                      {currentRoutine.title}
                    </h3>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl w-fit">
                    <span className="text-xs text-white/80 font-medium block">Circadian Interval</span>
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">{currentRoutine.time}</span>
                  </div>
                </div>

                {/* Routine Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentRoutine.items.map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors duration-300">
                      <span className="text-emerald-400 text-xs font-bold block mb-1">{item.duration}</span>
                      <h4 className="text-white text-sm font-semibold mb-2">{item.activity}</h4>
                      <p className="text-white/50 text-[11px] leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Footer CTA */}
              <div className="border-t border-white/5 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <BrainCircuit size={16} className="text-violet-400" />
                  <span>Personalized based on local circadian models.</span>
                </div>
                <button className="w-full sm:w-auto bg-white hover:bg-white/90 text-black text-xs font-bold px-5 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1">
                  Add Segment to Engine <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION C: SCIENTIFIC ADVISORY BOARD */}
      <section id="advisory-board" className="py-24 md:py-32 bg-[#06070b]">
        <div className="section-container">
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-16 md:mb-20">
            <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase block mb-3">
              Proven Methodology
            </span>
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              Guided by Scientific Experts
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Equilibrium is built in coordination with behavioral scientists, neuroscientists, and circadian researchers to ensure every recommendation aligns with clinical standards.
            </p>
          </div>

          {/* Expert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Expert 1 */}
            <div className="liquid-glass rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center hover:border-emerald-500/20 transition-all duration-300 group">
              <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-2 border-white/10 group-hover:border-emerald-500/30 transition-all">
                <img
                  src="/images/expert_evelyn.png"
                  alt="Dr. Evelyn Thorne"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </div>
              <h3 className="text-white text-lg font-bold">Dr. Evelyn Thorne</h3>
              <span className="text-emerald-400 text-xs font-semibold block mt-1 mb-4 uppercase tracking-wider">
                Lead Neuroscientist
              </span>
              <p className="text-white/60 text-[11px] leading-relaxed mb-6">
                Former Harvard researcher specializing in behavioral neural loops, habit formation thresholds, and autonomic nervous responses.
              </p>
              <div className="mt-auto bg-white/5 px-4 py-2 rounded-xl border border-white/5 w-full">
                <span className="text-[10px] text-white/40 block">Research focus</span>
                <span className="text-white/80 text-[10px] font-semibold block mt-0.5">Neuroplasticity & Routines</span>
              </div>
            </div>

            {/* Expert 2 */}
            <div className="liquid-glass rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center hover:border-violet-500/20 transition-all duration-300 group">
              <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-2 border-white/10 group-hover:border-violet-500/30 transition-all">
                <img
                  src="/images/expert_marcus.png"
                  alt="Marcus Vance"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </div>
              <h3 className="text-white text-lg font-bold">Marcus Vance</h3>
              <span className="text-violet-400 text-xs font-semibold block mt-1 mb-4 uppercase tracking-wider">
                Circadian Health Specialist
              </span>
              <p className="text-white/60 text-[11px] leading-relaxed mb-6">
                Developer of dynamic biological lighting frameworks, advising organizations on melatonin regulation and sleep cycle alignment.
              </p>
              <div className="mt-auto bg-white/5 px-4 py-2 rounded-xl border border-white/5 w-full">
                <span className="text-[10px] text-white/40 block">Research focus</span>
                <span className="text-white/80 text-[10px] font-semibold block mt-0.5">Chronobiology & Recovery</span>
              </div>
            </div>

            {/* Expert 3 */}
            <div className="liquid-glass rounded-3xl p-6 border border-white/5 flex flex-col items-center text-center hover:border-emerald-500/20 transition-all duration-300 group">
              <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-2 border-white/10 group-hover:border-emerald-500/30 transition-all">
                <img
                  src="/images/expert_sarah.png"
                  alt="Sarah Chen"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </div>
              <h3 className="text-white text-lg font-bold">Sarah Chen</h3>
              <span className="text-emerald-400 text-xs font-semibold block mt-1 mb-4 uppercase tracking-wider">
                Behavioral Psychologist
              </span>
              <p className="text-white/60 text-[11px] leading-relaxed mb-6">
                Specialist in motivational design patterns, cognitive offloading, and structural wellness habits that reduce burn-out.
              </p>
              <div className="mt-auto bg-white/5 px-4 py-2 rounded-xl border border-white/5 w-full">
                <span className="text-[10px] text-white/40 block">Research focus</span>
                <span className="text-white/80 text-[10px] font-semibold block mt-0.5">Habit Adherence Models</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. SECTION D: STATS & TESTIMONIALS */}
      <section className="py-24 bg-[#0c0e17] border-t border-white/5">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Stats (Left) */}
            <div className="lg:col-span-5 space-y-8">
              <div>
                <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase block mb-3">
                  Measurable Impact
                </span>
                <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">
                  The Science of Compounding Growth
                </h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  Small, structural shifts in your routine generate significant cognitive and physical enhancements over time.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="border-l-2 border-emerald-500 pl-4">
                  <span className="text-white text-3xl font-bold block">94%</span>
                  <span className="text-white/50 text-xs mt-1 block">Sleep Stability Increase</span>
                </div>
                <div className="border-l-2 border-violet-500 pl-4">
                  <span className="text-white text-3xl font-bold block">15M+</span>
                  <span className="text-white/50 text-xs mt-1 block">Routines Synced</span>
                </div>
                <div className="border-l-2 border-emerald-500 pl-4">
                  <span className="text-white text-3xl font-bold block">-34%</span>
                  <span className="text-white/50 text-xs mt-1 block">Autonomic Stress Reduction</span>
                </div>
                <div className="border-l-2 border-violet-500 pl-4">
                  <span className="text-white text-3xl font-bold block">4.9★</span>
                  <span className="text-white/50 text-xs mt-1 block">User Experience Rating</span>
                </div>
              </div>
            </div>

            {/* Testimonials Card (Right) */}
            <div className="lg:col-span-7">
              <div className="liquid-glass rounded-3xl p-8 border border-white/10 relative">
                <div className="flex items-center gap-1.5 text-yellow-500 mb-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-sm">★</span>
                  ))}
                </div>
                <blockquote className="text-white/90 text-base md:text-lg font-medium leading-relaxed mb-6 italic">
                  "Equilibrium completely structured how I transition through my day. Working on the screen is draining, but the circadian light warnings and somatic breathing breaks have helped me sleep deeper and retain energy until late evening."
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                    EL
                  </div>
                  <div>
                    <span className="text-white text-sm font-semibold block">Elena Rostova</span>
                    <span className="text-white/40 text-xs block">Engineering Director, Berlin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. SECTION E: PREMIUM FOOTER */}
      <footer className="relative bg-[#06070b] pt-20 pb-12 border-t border-white/5">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 pb-16 border-b border-white/5">
            {/* Branding */}
            <div className="lg:col-span-5 space-y-5">
              <div className="flex items-center gap-2 text-white font-semibold text-xl">
                <Infinity size={28} className="text-emerald-500" strokeWidth={1.5} />
                <span>Equilibrium</span>
              </div>
              <p className="text-white/50 text-xs sm:text-sm leading-relaxed max-w-sm">
                Empowering individuals to synchronize sleep patterns, physical outputs, and mental mindfulness through localized circadian alignment architectures.
              </p>
              <div className="flex items-center gap-3 text-white/40 text-xs">
                <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                  <Lock size={12} className="text-emerald-500" />
                  <span>Encrpyted Logs</span>
                </div>
                <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                  <Globe size={12} className="text-violet-500" />
                  <span>HIPAA Aligned</span>
                </div>
              </div>
            </div>

            {/* Links Block 1 */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Features</h4>
              <ul className="space-y-2.5 text-xs text-white/50">
                <li><a href="#wellness-hub" className="hover:text-white transition-colors">Wellness Hub</a></li>
                <li><a href="#daily-planner" className="hover:text-white transition-colors">Daily Planner</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Circadian Analytics</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Biofeedback Sync</a></li>
              </ul>
            </div>

            {/* Links Block 2 */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Advisory</h4>
              <ul className="space-y-2.5 text-xs text-white/50">
                <li><a href="#advisory-board" className="hover:text-white transition-colors">Scientific Board</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Clinical Studies</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Whitepaper</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Partnerships</a></li>
              </ul>
            </div>

            {/* Newsletter Input (Right Column) */}
            <div className="lg:col-span-3 space-y-4">
              <h4 className="text-white text-xs font-bold uppercase tracking-wider">Newsletter</h4>
              <p className="text-white/50 text-xs leading-relaxed">
                Receive biological recovery tips and updates weekly.
              </p>
              
              {newsletterSubscribed ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-2xl text-xs font-medium">
                  ✓ Success! You have subscribed.
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-white hover:bg-white/90 text-black text-xs font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-[11px] text-white/40">
            <span>© {new Date().getFullYear()} Equilibrium Inc. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Data Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
