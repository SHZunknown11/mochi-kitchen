import { React, useState, useEffect, useRef, useCallback, e } from './react.js';

/**
 * Web Audio procedural kitchen sound generator.
 * Works completely offline, zero external audio assets required.
 */
class KitchenSoundEngine {
  constructor() {
    this.ctx = null;
    this.sizzleNode = null;
    this.sizzleGain = null;
    this.isMuted = false;
    this.volume = 0.25;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startSizzle(intensity = 'med') {
    this.ensureContext();
    if (!this.ctx) return;
    this.stopSizzle();

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink / crackle noise generation
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter to simulate frying/simmering pan resonance
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const freqs = { low: 1100, med: 1750, high: 2400 };
    filter.frequency.value = freqs[intensity] || 1750;
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    const baseGains = { low: 0.12, med: 0.22, high: 0.32 };
    gain.gain.value = (baseGains[intensity] || 0.2) * (this.isMuted ? 0 : this.volume);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    this.sizzleNode = noise;
    this.sizzleGain = gain;
  }

  setHeat(intensity) {
    if (this.sizzleNode) {
      this.startSizzle(intensity);
    }
  }

  stopSizzle() {
    if (this.sizzleGain && this.ctx) {
      try {
        this.sizzleGain.gain.setValueAtTime(this.sizzleGain.gain.value, this.ctx.currentTime);
        this.sizzleGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);
      } catch { /* ignored */ }
    }
    if (this.sizzleNode) {
      try { this.sizzleNode.stop(this.ctx.currentTime + 0.16); } catch { /* ignored */ }
      this.sizzleNode = null;
    }
  }

  playToss() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Soft whoosh pitch envelope
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.3);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * this.volume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);

    // Burst of sizzle crackle on landing
    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(320, t);
      popOsc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      popGain.gain.setValueAtTime(0.25 * this.volume, t);
      popGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      popOsc.connect(popGain);
      popGain.connect(this.ctx.destination);
      popOsc.start(t);
      popOsc.stop(t + 0.12);
    }, 180);
  }

  playChime() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6 (pleasant bell chime)

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.13;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.95);
    });
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.sizzleGain && this.ctx && !this.isMuted) {
      this.sizzleGain.gain.setValueAtTime(this.volume * 0.22, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.sizzleGain && this.ctx) {
      this.sizzleGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume * 0.22, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const kitchenAudio = new KitchenSoundEngine();

/**
 * Animated SVG Steam Wisps
 */
export function SteamParticles({ intensity = 'med', active = true }) {
  if (!active) return null;
  const count = intensity === 'high' ? 5 : intensity === 'med' ? 3 : 2;
  const paths = [
    'M10 50 Q18 35 12 22 Q6 10 14 0',
    'M25 55 Q15 38 28 20 Q35 8 24 0',
    'M40 50 Q48 32 38 18 Q30 6 42 0',
    'M18 48 Q26 30 18 16 Q12 5 22 0',
    'M32 52 Q22 36 34 20 Q42 7 30 0',
  ];

  return e('div', { className: `steam-container steam-${intensity}`, 'aria-hidden': 'true' },
    paths.slice(0, count).map((d, i) =>
      e('svg', {
        key: i,
        viewBox: '0 0 50 60',
        className: `steam-wisp steam-wisp-${i + 1}`,
      },
      e('path', {
        d,
        fill: 'none',
        stroke: 'rgba(255, 255, 255, 0.75)',
        strokeWidth: '4.5',
        strokeLinecap: 'round',
      }))));
}

/**
 * Animated Cooking Pan / Donabe Pot
 */
export function CookingVessel({ mode, heat, isTossing, onToss }) {
  const isPot = mode === 'pot';

  return e('div', { className: 'cooking-vessel-stage' },
    e(SteamParticles, { intensity: heat, active: heat !== 'off' }),
    e('div', {
      className: `vessel-wrap ${mode} heat-${heat} ${isTossing ? 'is-tossing' : ''}`,
      onClick: onToss,
      title: isPot ? 'Simmering dashi stew (click to stir)' : 'Sizzling pan (click to toss & stir)',
      role: 'button',
      tabIndex: 0,
      onKeyDown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') onToss(); },
    },
    // The visual pan/pot
    isPot ? e('div', { className: 'donabe-pot' },
      e('div', { className: 'pot-lid-handle' }),
      e('div', { className: 'pot-rim' }),
      e('div', { className: 'pot-broth' },
        e('div', { className: 'broth-bubble bubble-1' }),
        e('div', { className: 'broth-bubble bubble-2' }),
        e('div', { className: 'broth-bubble bubble-3' }),
        e('div', { className: 'floating-garnish tofu' }, '◻'),
        e('div', { className: 'floating-garnish mushroom' }, '🍄'),
        e('div', { className: 'floating-garnish scallion' }, '🥬'),
        e('div', { className: 'floating-garnish carrot' }, '🥕')),
      e('div', { className: 'pot-base' }))
      : e('div', { className: 'frying-pan' },
        e('div', { className: 'pan-handle' }),
        e('div', { className: 'pan-body' },
          e('div', { className: 'pan-oil-shimmer' }),
          e('div', { className: `tossable-ingredients ${isTossing ? 'flipping' : ''}` },
            e('span', { className: 'pan-food egg' }, '🍳'),
            e('span', { className: 'pan-food veg1' }, '🥦'),
            e('span', { className: 'pan-food veg2' }, '🥕'),
            e('span', { className: 'pan-food veg3' }, '🧄'),
            e('span', { className: 'pan-food sizzle-spark spark-1' }, '✨'),
            e('span', { className: 'pan-food sizzle-spark spark-2' }, '✨')))),
    // Stove burner glow underneath
    e('div', { className: `burner-flame burner-${heat}` },
      e('div', { className: 'flame-inner' }))),
    e('p', { className: 'vessel-caption' },
      isPot ? '🍲 Clay Pot Simmer · Dashi & Fresh Vegetables' : '🍳 Sizzling Skillet · Toss & Stir-fry'));
}

/**
 * Interactive Cooking Station (Live Kitchen Vibe Bar)
 */
export function KitchenLiveBar({ onOpenTimer }) {
  const [mode, setMode] = useState('wok'); // 'wok' | 'pot'
  const [heat, setHeat] = useState('med'); // 'low' | 'med' | 'high'
  const [isTossing, setIsTossing] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);

  const handleToss = useCallback(() => {
    if (isTossing) return;
    setIsTossing(true);
    kitchenAudio.playToss();
    setTimeout(() => setIsTossing(false), 600);
  }, [isTossing]);

  const toggleSound = useCallback(() => {
    if (audioActive) {
      kitchenAudio.stopSizzle();
      setAudioActive(false);
    } else {
      kitchenAudio.startSizzle(heat);
      setAudioActive(true);
    }
  }, [audioActive, heat]);

  const changeHeat = (newHeat) => {
    setHeat(newHeat);
    if (audioActive) {
      kitchenAudio.setHeat(newHeat);
    }
  };

  return e('section', { className: 'kitchen-vibe-bar card' },
    e('div', { className: 'kitchen-bar-header' },
      e('div', { className: 'bar-title-wrap' },
        e('span', { className: 'chef-badge', 'aria-hidden': 'true' }, '👨‍🍳'),
        e('div', {},
          e('h2', { className: 'bar-title' }, 'Mochi Kitchen Studio'),
          e('p', { className: 'bar-subtitle' }, 'Live Cooking Station · 100% Beef-Free Menu · Cozy Kitchen Vibes'))),
      e('div', { className: 'bar-badges' },
        e('span', { className: 'kitchen-pill beef-free-pill' }, '🌱 No Beef · Fresh & Clean'),
        e('span', { className: 'kitchen-pill live-pill' }, '♨️ Active Stove'))),

    e('div', { className: 'kitchen-stage-grid' },
      // Left: Vessel animation
      e(CookingVessel, {
        mode,
        heat,
        isTossing,
        onToss: handleToss,
      }),

      // Right: Kitchen Controls & Soundscape
      e('div', { className: 'kitchen-controls' },
        e('div', { className: 'control-group' },
          e('span', { className: 'control-label' }, 'Cookware:'),
          e('div', { className: 'btn-switch-group' },
            e('button', {
              type: 'button',
              className: `btn-switch ${mode === 'wok' ? 'active' : ''}`,
              onClick: () => setMode('wok'),
            }, '🍳 Sauté Skillet'),
            e('button', {
              type: 'button',
              className: `btn-switch ${mode === 'pot' ? 'active' : ''}`,
              onClick: () => setMode('pot'),
            }, '🍲 Simmer Pot'))),

        e('div', { className: 'control-group' },
          e('span', { className: 'control-label' }, 'Burner Heat:'),
          e('div', { className: 'btn-heat-group' },
            e('button', {
              type: 'button',
              className: `btn-heat low ${heat === 'low' ? 'active' : ''}`,
              onClick: () => changeHeat('low'),
            }, '♨️ Low Simmer'),
            e('button', {
              type: 'button',
              className: `btn-heat med ${heat === 'med' ? 'active' : ''}`,
              onClick: () => changeHeat('med'),
            }, '🔥 Medium'),
            e('button', {
              type: 'button',
              className: `btn-heat high ${heat === 'high' ? 'active' : ''}`,
              onClick: () => changeHeat('high'),
            }, '⚡ High Flame'))),

        e('div', { className: 'action-row' },
          e('button', {
            type: 'button',
            className: `btn kitchen-action-btn ${isTossing ? 'animating' : ''}`,
            onClick: handleToss,
          }, mode === 'wok' ? '🍳 Toss & Sizzle!' : '🥄 Stir the Stew!'),

          e('button', {
            type: 'button',
            className: `btn ghost sound-toggle-btn ${audioActive ? 'sound-on' : ''}`,
            onClick: toggleSound,
            title: 'Toggle procedural sizzling & bubbling ambient sound',
          },
          e('span', { className: 'sound-icon' }, audioActive ? '🔊' : '🔈'),
          audioActive ? 'Sizzle Ambience: ON' : 'Kitchen Sound',
          audioActive && e('span', { className: 'sound-waves', 'aria-hidden': 'true' },
            e('span', { className: 'wave b1' }),
            e('span', { className: 'wave b2' }),
            e('span', { className: 'wave b3' }))),

          e('button', {
            type: 'button',
            className: `btn ghost timer-toggle-btn ${timerOpen ? 'active' : ''}`,
            onClick: () => {
              const next = !timerOpen;
              setTimerOpen(next);
              if (onOpenTimer) onOpenTimer(next);
            },
          }, '⏱️ Cooking Timer')))),

    // Expandable Chef Timer
    timerOpen && e('div', { className: 'timer-drawer' }, e(ChefTimer, { onClose: () => setTimerOpen(false) })));
}

/**
 * Chef's Precision Kitchen Timer
 */
export function ChefTimer({ onClose }) {
  const PRESETS = [
    { label: '🥚 Soft Egg', sec: 390 }, // 6m 30s
    { label: '🍜 Ramen', sec: 180 }, // 3m 00s
    { label: '🍚 Steamed Rice', sec: 900 }, // 15m 00s
    { label: '🥦 Quick Blanch', sec: 90 }, // 1m 30s
    { label: '🍵 Green Tea', sec: 120 }, // 2m 00s
  ];

  const [secondsLeft, setSecondsLeft] = useState(180);
  const [initialSeconds, setInitialSeconds] = useState(180);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            setIsFinished(true);
            kitchenAudio.playChime();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, secondsLeft]);

  const selectPreset = (sec) => {
    setIsRunning(false);
    setIsFinished(false);
    setInitialSeconds(sec);
    setSecondsLeft(sec);
  };

  const adjustTime = (deltaSec) => {
    setIsFinished(false);
    setSecondsLeft((prev) => Math.max(10, prev + deltaSec));
    setInitialSeconds((prev) => Math.max(10, prev + deltaSec));
  };

  const toggleRun = () => {
    if (secondsLeft === 0) {
      setSecondsLeft(initialSeconds);
      setIsFinished(false);
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsFinished(false);
    setSecondsLeft(initialSeconds);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progressPercent = initialSeconds > 0 ? (secondsLeft / initialSeconds) : 0;
  const circleRadius = 54;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - progressPercent);

  return e('div', { className: 'chef-timer-card' },
    e('div', { className: 'timer-top' },
      e('h3', { className: 'timer-title' }, '⏱️ Kitchen Cook Timer'),
      onClose && e('button', {
        type: 'button',
        className: 'btn ghost small close-timer-btn',
        onClick: onClose,
        'aria-label': 'Close timer',
      }, '✕')),

    e('div', { className: 'timer-presets' },
      PRESETS.map((p) => e('button', {
        key: p.label,
        type: 'button',
        className: `preset-chip ${initialSeconds === p.sec && !isRunning ? 'selected' : ''}`,
        onClick: () => selectPreset(p.sec),
      }, p.label))),

    e('div', { className: 'timer-display-wrap' },
      e('div', { className: `timer-dial ${isFinished ? 'timer-ring-finished' : ''}` },
        e('svg', { className: 'timer-svg', viewBox: '0 0 120 120' },
          e('circle', {
            className: 'timer-track',
            cx: 60,
            cy: 60,
            r: circleRadius,
            fill: 'none',
            strokeWidth: 8,
          }),
          e('circle', {
            className: 'timer-progress',
            cx: 60,
            cy: 60,
            r: circleRadius,
            fill: 'none',
            strokeWidth: 8,
            strokeDasharray: circumference,
            strokeDashoffset,
            strokeLinecap: 'round',
            transform: 'rotate(-90 60 60)',
          })),
        e('div', { className: 'timer-digits-container' },
          e('span', { className: 'timer-digits' }, timeFormatted),
          e('span', { className: 'timer-status-sub' },
            isFinished ? 'Ding! Ready!' : isRunning ? 'Cooking...' : 'Ready')))),

    isFinished && e('div', { className: 'timer-finished-banner' },
      '🔔 Order ready! Remove from heat and enjoy your dish!'),

    e('div', { className: 'timer-controls' },
      e('button', {
        type: 'button',
        className: 'btn ghost small adjust-btn',
        onClick: () => adjustTime(-60),
        title: 'Subtract 1 minute',
      }, '-1m'),
      e('button', {
        type: 'button',
        className: `btn timer-main-btn ${isRunning ? 'btn-pause' : 'btn-start'}`,
        onClick: toggleRun,
      }, isRunning ? '⏸️ Pause' : '▶ Start'),
      e('button', {
        type: 'button',
        className: 'btn ghost small adjust-btn',
        onClick: () => adjustTime(60),
        title: 'Add 1 minute',
      }, '+1m'),
      e('button', {
        type: 'button',
        className: 'btn ghost small reset-btn',
        onClick: resetTimer,
        title: 'Reset timer',
      }, '↺ Reset')));
}

/**
 * Floating Kitchen Ambiance (Utensils & Fresh Produce Doodles)
 */
export function FloatingKitchenAmbiance() {
  const items = [
    { icon: '🥄', label: 'Wooden spoon', top: '12%', left: '4%', delay: '0s', dur: '5.5s' },
    { icon: '🧄', label: 'Garlic bulb', top: '28%', left: '92%', delay: '1s', dur: '6.2s' },
    { icon: '🥢', label: 'Chopsticks', top: '55%', left: '2%', delay: '2s', dur: '4.8s' },
    { icon: '🍄', label: 'Shiitake mushroom', top: '78%', left: '90%', delay: '0.5s', dur: '6s' },
    { icon: '🧂', label: 'Salt shaker', top: '88%', left: '6%', delay: '1.5s', dur: '5.2s' },
    { icon: '🥦', label: 'Fresh broccoli', top: '6%', left: '88%', delay: '2.5s', dur: '5.8s' },
  ];

  return e('div', { className: 'floating-kitchen-ambiance', 'aria-hidden': 'true' },
    items.map((it, idx) =>
      e('span', {
        key: idx,
        className: 'floating-kitchen-item',
        title: it.label,
        style: {
          top: it.top,
          left: it.left,
          animationDelay: it.delay,
          animationDuration: it.dur,
        },
      }, it.icon)));
}

/**
 * Interactive Step-by-Step "Cook Along" with Timer Integration for Recipe Details
 */
export function KitchenCookAlong({ steps = [], recipeTitle = '' }) {
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [activeStep, setActiveStep] = useState(0);
  const [activeTimerSec, setActiveTimerSec] = useState(null);

  const toggleStep = (idx) => {
    const next = new Set(completedSteps);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
      if (idx === activeStep && idx < steps.length - 1) {
        setActiveStep(idx + 1);
      }
    }
    setCompletedSteps(next);
  };

  // Helper to extract minutes from step text e.g. "Simmer for 15 minutes" -> 15
  const extractMinutes = (text) => {
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:minute|min)/i);
    return match ? Math.round(parseFloat(match[1]) * 60) : null;
  };

  const progress = steps.length > 0 ? Math.round((completedSteps.size / steps.length) * 100) : 0;

  return e('div', { className: 'kitchen-cook-along card matcha' },
    e('div', { className: 'cook-along-header' },
      e('div', {},
        e('h3', { className: 'cook-along-title' }, '🍳 Cook-Along Companion'),
        e('p', { className: 'cook-along-subtitle' }, `Track your cooking progress step by step · ${completedSteps.size} of ${steps.length} done`)),
      e('div', { className: 'cook-along-badge' }, `${progress}% Prepared`)),

    e('div', { className: 'cook-along-progress-bar', 'aria-hidden': 'true' },
      e('div', { className: 'cook-along-progress-fill', style: { width: `${progress}%` } })),

    activeTimerSec && e('div', { className: 'cook-inline-timer' },
      e(ChefTimer, { onClose: () => setActiveTimerSec(null) })),

    e('ol', { className: 'cook-steps-list' },
      steps.map((step, idx) => {
        const isDone = completedSteps.has(idx);
        const isCurrent = idx === activeStep && !isDone;
        const durationSec = extractMinutes(step);

        return e('li', {
          key: idx,
          className: `cook-step-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`,
        },
        e('label', { className: 'cook-step-label' },
          e('input', {
            type: 'checkbox',
            className: 'cook-checkbox',
            checked: isDone,
            onChange: () => toggleStep(idx),
          }),
          e('span', { className: 'cook-step-num' }, `Step ${idx + 1}`),
          e('span', { className: 'cook-step-text' }, step)),
        durationSec && e('button', {
          type: 'button',
          className: 'btn ghost small cook-step-timer-btn',
          onClick: () => setActiveTimerSec(durationSec),
          title: `Start ${Math.round(durationSec / 60)}m cooking timer`,
        }, `⏱️ Start ${Math.round(durationSec / 60)}m timer`));
      })),

    progress === 100 && e('div', { className: 'all-done-banner' },
      '🎉 All steps completed! Plate your masterpiece and enjoy!'));
}

