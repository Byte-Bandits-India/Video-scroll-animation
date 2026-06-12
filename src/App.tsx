import { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';

const TOTAL_FRAMES = 685;
const BATCH_SIZE = 30;



export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Loader States
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [loaderOpacity, setLoaderOpacity] = useState(1);
  const [showLoader, setShowLoader] = useState(true);

  // Scroll / Canvas States and DOM Refs
  const scrollProgressRef = useRef(0);
  const currentFrameRef = useRef(0);
  const animatedFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  
  const runwayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const leftBadgeRef = useRef<HTMLDivElement>(null);
  const rightBadgeRef = useRef<HTMLDivElement>(null);
  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const phase3Ref = useRef<HTMLDivElement>(null);
  const phase4Ref = useRef<HTMLDivElement>(null);

  // Interactive UI States
  const [activePlannerTab, setActivePlannerTab] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
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

  // 2. Passive Scroll Listener (reflow-free using window scroll offset)
  useEffect(() => {
    if (!loadingComplete) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll <= 0 ? 0 : scrollY / maxScroll;
      const normalized = Math.max(0, Math.min(1, progress));

      scrollProgressRef.current = normalized;

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

  // 3. requestAnimationFrame (rAF) Render Loop (Optimized with responsive LERP and throttled DOM updates)
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
      
      // Interpolate the frame index smoothly
      const targetFrame = currentFrameRef.current;
      const diff = targetFrame - animatedFrameRef.current;
      
      // 0.15 coefficient filters out micro-stutters from slow scrolls without lag
      if (Math.abs(diff) < 0.01) {
        animatedFrameRef.current = targetFrame;
      } else {
        animatedFrameRef.current += diff * 0.07;
      }

      const currentFrame = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(animatedFrameRef.current)));

      // 1. Draw frame ONLY if rounded frame index changes (throttled to canvas update rate)
      if (ctx && images[currentFrame] && currentFrame !== drawnFrameRef.current) {
        const img = images[currentFrame];
        ctx.clearRect(0, 0, 1280, 720);
        ctx.drawImage(img, 0, 0, 1280, 720);
        drawnFrameRef.current = currentFrame;
      }

      // 2. Perform smooth transform and progress updates on EVERY frame (fluid 60Hz/120Hz continuous)
      const easedProgress = animatedFrameRef.current / (TOTAL_FRAMES - 1);
      
      // Smooth scale and rotation (GPU accelerated, continuous)
      const rotation = -3.5 + easedProgress * 9.5; // subtle rotation sweep (-3.5deg to +6deg)
      const scale = 1.05 - easedProgress * 0.05;   // zoom from 1.05 to 1.0
      canvas.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;

      // Smooth progress bar width
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${easedProgress * 100}%`;
      }

      // Phased cards visibility driven by continuous eased progress (optimized check)
      const togglePhase = (ref: React.RefObject<HTMLDivElement>, active: boolean) => {
        if (ref.current) {
          const hasClass = ref.current.classList.contains('visible');
          if (active && !hasClass) {
            ref.current.classList.add('visible');
          } else if (!active && hasClass) {
            ref.current.classList.remove('visible');
          }
        }
      };

      togglePhase(phase1Ref, easedProgress >= 0.00 && easedProgress <= 0.22);
      togglePhase(phase2Ref, easedProgress >= 0.26 && easedProgress <= 0.45);
      togglePhase(phase3Ref, easedProgress >= 0.50 && easedProgress <= 0.68);
      togglePhase(phase4Ref, easedProgress >= 0.74 && easedProgress <= 0.94);

      // Starting Floating Badges driven by continuous eased progress (optimized check)
      const isStart = easedProgress >= 0.00 && easedProgress <= 0.22;
      
      const toggleBadge = (ref: React.RefObject<HTMLDivElement>, active: boolean) => {
        if (ref.current) {
          const isVisible = ref.current.classList.contains('opacity-100');
          if (active && !isVisible) {
            ref.current.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            ref.current.classList.add('opacity-100', 'scale-100');
          } else if (!active && isVisible) {
            ref.current.classList.remove('opacity-100', 'scale-100');
            ref.current.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
          }
        }
      };

      toggleBadge(leftBadgeRef, isStart);
      toggleBadge(rightBadgeRef, isStart);

      rAFId = requestAnimationFrame(tick);
    };

    rAFId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rAFId);
    };
  }, [loadingComplete]);



  return (
    <div className="relative bg-[#090909] text-white min-h-screen">
      {/* Scroll Progress Indicator */}
      {/* <div className="fixed top-0 left-0 right-0 h-[3px] bg-neutral-950 z-[999] pointer-events-none">
      </div> */}

      {/* Loader Overlay */}
      {showLoader && (
        <div
          style={{ opacity: loaderOpacity }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090909] transition-opacity duration-700 ease-in-out"
        >
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl md:text-6xl font-light tracking-[0.4em] text-white brand-font select-none">
              MONAC
            </h1>
          </div>
          <div className="absolute bottom-24 flex flex-col items-center w-64 md:w-80">
            <div className="flex justify-between w-full mb-3 text-[10px] text-neutral-500 font-mono tracking-[0.2em]">
              <span>PRELOADING SCENE</span>
              <span>{Math.round((loadedCount / TOTAL_FRAMES) * 100)}%</span>
            </div>
            <div className="w-full h-[1px] bg-neutral-900 overflow-hidden rounded-full">
              <div
                className="h-full bg-white transition-all duration-300 ease-out"
                style={{ width: `${(loadedCount / TOTAL_FRAMES) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Elegant Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-6 md:px-12 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white/70 hover:text-white transition-colors p-2"
          aria-label="Toggle Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>

        <a href="#" className="absolute left-1/2 -translate-x-1/2 select-none">
          <span className="text-xl md:text-2xl font-light tracking-[0.35em] text-white hover:text-white/85 transition-colors">
            MONAC
          </span>
        </a>

        <div className="flex items-center gap-4">
          <button className="text-white/70 hover:text-white transition-colors p-2" aria-label="Search">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="text-white/70 hover:text-white transition-colors p-2 relative" aria-label="Shopping Cart">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-white rounded-full animate-ping" />
          </button>
        </div>
      </header>

      {/* Full-screen Menu Overlay */}
      <div
        className={`fixed inset-0 z-35 bg-black/95 backdrop-blur-lg transition-all duration-700 ease-in-out ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full gap-8 text-center">
          <nav className="flex flex-col gap-6 text-lg md:text-2xl font-light tracking-[0.25em] text-white">
            <a href="#" onClick={() => setMenuOpen(false)} className="hover:text-neutral-400 transition-colors">COLLECTION</a>
            <a href="#" onClick={() => setMenuOpen(false)} className="hover:text-neutral-400 transition-colors">THE OLFACTORY NOTES</a>
            <a href="#" onClick={() => setMenuOpen(false)} className="hover:text-neutral-400 transition-colors">CRAFTSMANSHIP</a>
            <a href="#" onClick={() => setMenuOpen(false)} className="hover:text-neutral-400 transition-colors">PRE-ORDER</a>
          </nav>
          <div className="w-12 h-[1px] bg-white/10 my-4" />
          <div className="text-[10px] tracking-[0.2em] text-neutral-500">
            MONAC HAUTE PARFUMERIE © 2026
          </div>
        </div>
      </div>

      {/* Floating Badges */}
      <div
        ref={leftBadgeRef}
        className="badge-left pointer-events-none fixed top-1/2 left-8 md:left-12 z-20 text-[9px] md:text-[10px] tracking-[0.35em] font-light text-neutral-500 border-b border-white/10 pb-2 uppercase origin-left"
      >
        MONAC
      </div>
      <div
        ref={rightBadgeRef}
        className="badge-right pointer-events-none fixed top-1/2 right-8 md:right-12 z-20 text-[9px] md:text-[10px] tracking-[0.35em] font-light text-neutral-500 border-b border-white/10 pb-2 uppercase origin-right"
      >
        EAU DE PARFUM
      </div>

      {/* Scroll Runway */}
      <div ref={runwayRef} className="relative w-full h-[450vh] bg-[#090909]">
        {/* Sticky Canvas Frame Container */}
        <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center z-10">
          <canvas
            ref={canvasRef}
            id="frame-canvas"
            width={1280}
            height={720}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-auto md:w-full md:h-auto max-w-none md:max-w-[1280px] aspect-video object-contain"
          />
        </div>

        {/* Phase Overlays */}
        {/* Phase 1: Product Intro */}
        <div
          ref={phase1Ref}
          className="phase-card fixed bottom-10 left-6 right-6 md:bottom-16 md:left-16 md:right-auto md:top-auto md:translate-y-0 z-20 max-w-sm md:max-w-md p-4 flex flex-col gap-4 text-center md:text-left items-center md:items-start"
        >
          <span className="text-white/40 text-[10px] font-semibold tracking-[0.25em] uppercase font-cinzel">MONAC / Signature</span>
          <p className="text-sm text-neutral-400 font-light leading-relaxed font-playfair italic">
            "A sensory exploration of absolute symmetry. Balanced perfectly between the ephemeral and the eternal, MONAC is designed to float with you through time."
          </p>
          <div className="w-12 h-[1px] bg-white/10 mt-2" />
        </div>

        {/* Phase 2: Scent Profile */}
        <div
          ref={phase2Ref}
          className="phase-card fixed bottom-10 left-6 right-6 md:bottom-16 md:right-16 md:left-auto md:top-auto md:translate-y-0 z-20 max-w-sm md:max-w-md p-4 flex flex-col gap-4 text-center md:text-left items-center md:items-start"
        >
          <span className="text-white/40 text-[10px] font-semibold tracking-[0.25em] uppercase font-cinzel">The Scent Profile</span>
          <h2 className="text-2xl md:text-3xl font-light text-white leading-tight font-cinzel">THE NOTES</h2>
          <div className="flex flex-col gap-4 mt-2 text-left w-full">
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-white/60 text-[10px] tracking-[0.15em] font-semibold uppercase font-cinzel">Top Notes</span>
              <span className="text-sm text-white font-medium mt-0.5 font-playfair italic">Calabrian Bergamot & Pink Pepper</span>
              <span className="text-xs text-neutral-400 mt-1 font-light">A crisp, invigorating opening that captures the light.</span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-white/60 text-[10px] tracking-[0.15em] font-semibold uppercase font-cinzel">Heart Notes</span>
              <span className="text-sm text-white font-medium mt-0.5 font-playfair italic">French Lavender & Incense</span>
              <span className="text-xs text-neutral-400 mt-1 font-light">A calm, meditative core that adds a layer of mystery.</span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-white/60 text-[10px] tracking-[0.15em] font-semibold uppercase font-cinzel">Base Notes</span>
              <span className="text-sm text-white font-medium mt-0.5 font-playfair italic">Indonesian Patchouli & Amberwood</span>
              <span className="text-xs text-neutral-400 mt-1 font-light">A warm, resinous foundation that lingers elegantly.</span>
            </div>
          </div>
        </div>

        {/* Phase 3: Craftsmanship */}
        <div
          ref={phase3Ref}
          className="phase-card fixed bottom-10 left-6 right-6 md:bottom-16 md:left-16 md:right-auto md:top-auto md:translate-y-0 z-20 max-w-sm md:max-w-md p-4 flex flex-col gap-4 text-center md:text-left items-center md:items-start"
        >
          <span className="text-white/40 text-[10px] font-semibold tracking-[0.25em] uppercase font-cinzel">Artisanal Design</span>
          <h2 className="text-2xl md:text-3xl font-light text-white leading-tight font-cinzel">CRAFTSMANSHIP</h2>
          <p className="text-sm text-neutral-400 font-light leading-relaxed font-playfair italic">
            Every bottle of MONAC is a piece of art. Formed from ultra-heavy glass, hand-polished to catch light, and crowned with a bespoke magnetic wooden cap that snaps perfectly into position.
          </p>
          <div className="flex gap-4 mt-2 w-full">
            <div className="flex flex-col flex-1 p-3 rounded-lg bg-neutral-950/40 border border-white/5 text-left">
              <span className="text-white/60 text-[9px] font-semibold tracking-[0.1em] uppercase font-cinzel">Bottle</span>
              <span className="text-xs text-neutral-300 mt-1">French Lead-Free Glass</span>
            </div>
            <div className="flex flex-col flex-1 p-3 rounded-lg bg-neutral-950/40 border border-white/5 text-left">
              <span className="text-white/60 text-[9px] font-semibold tracking-[0.1em] uppercase font-cinzel">Cap</span>
              <span className="text-xs text-neutral-300 mt-1">Bespoke Magnetic Wood</span>
            </div>
          </div>
        </div>

        {/* Phase 4: Reservation & Checkout CTA */}
        <div
          ref={phase4Ref}
          className="phase-card fixed bottom-10 left-6 right-6 md:bottom-16 md:right-16 md:left-auto md:top-auto md:translate-y-0 z-20 max-w-sm md:max-w-md p-4 flex flex-col gap-6 text-center md:text-left items-center md:items-start"
        >
          <span className="text-white/40 text-[10px] font-semibold tracking-[0.25em] uppercase font-cinzel">Exclusive Release</span>
          <h2 className="text-2xl md:text-3xl font-light text-white leading-tight font-cinzel">OWN THE EXPERIENCE</h2>
          
          <div className="flex flex-col gap-4 w-full text-left">
            <div className="flex justify-between items-center p-3 rounded-xl border border-white/10 bg-white/5">
              <div className="flex flex-col">
                <span className="text-xs text-white font-medium font-cinzel">MONAC Eau de Parfum</span>
                <span className="text-[10px] text-neutral-400 mt-0.5">Select Size</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePlannerTab('morning')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-widest border transition-all font-cinzel ${
                    activePlannerTab === 'morning'
                      ? 'bg-white border-white text-black'
                      : 'border-white/10 hover:border-white/20 text-white'
                  }`}
                >
                  50ML
                </button>
                <button
                  onClick={() => setActivePlannerTab('afternoon')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-widest border transition-all font-cinzel ${
                    activePlannerTab === 'afternoon'
                      ? 'bg-white border-white text-black'
                      : 'border-white/10 hover:border-white/20 text-white'
                  }`}
                >
                  100ML
                </button>
              </div>
            </div>

            <div className="flex justify-between items-end border-b border-white/5 pb-4">
              <span className="text-xs text-neutral-400">Price</span>
              <span className="text-xl font-light text-white font-cinzel">
                {activePlannerTab === 'morning' ? '$140.00' : '$220.00'}
              </span>
            </div>
          </div>

          {newsletterSubscribed ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-400 text-xs tracking-wider w-full">
              Successfully added to your reservation!
            </div>
          ) : (
            <button
              onClick={() => setNewsletterSubscribed(true)}
              className="w-full py-4 bg-white hover:bg-neutral-200 text-black font-semibold text-xs tracking-[0.2em] rounded-xl transition-all duration-300 shadow-[0_4px_20px_rgba(255,255,255,0.05)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.1)] uppercase font-cinzel"
            >
              Reserve Bottle
            </button>
          )}
          <p className="text-[9px] text-neutral-500 text-center leading-relaxed">
            *Limited batch production. Hand-numbered bottles. Standard complimentary shipping worldwide included.
          </p>
        </div>
      </div>

      {/* Subtle bottom footer overlay */}
      <footer className="relative bg-[#050505] border-t border-white/5 py-12 px-6 text-center z-20">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-6">
          <span className="text-xl font-light tracking-[0.4em] text-white font-cinzel">MONAC</span>
          <p className="text-xs text-neutral-400 tracking-wider max-w-md font-playfair italic">
            MONAC represents the pinnacle of luxury, symmetry, and balance.
          </p>
          <div className="w-12 h-[1px] bg-white/10" />
          <div className="text-[10px] text-neutral-500 tracking-[0.2em] uppercase font-cinzel">
            © 2026 MONAC HAUTE PARFUMERIE. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </div>
  );
}
