/**
 * Praveen Gautam — Portfolio Interactive Engine
 * Inspired by therishithakor.com mechanics
 */

(function () {
  'use strict';

  // Helper shortcuts
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const root = document.documentElement;

  /* ==========================================================================
     1. Sound System (Tactile audio feedback)
     ========================================================================== */
  let soundEnabled = true;
  const audioCtx = window.AudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;

  function playTone(freq = 440, type = 'sine', duration = 0.08, vol = 0.04) {
    if (!soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  const soundToggle = $('#soundToggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggle.classList.toggle('muted', !soundEnabled);
      if (soundEnabled) playTone(580, 'sine', 0.1, 0.05);
    });
  }

  /* ==========================================================================
     2. Page HUD Loader
     ========================================================================== */
  const loader = $('#loader');
  const ldCount = $('#ldCount');
  const ldBar = $('#ldBar');

  if (loader && ldCount && ldBar) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        ldCount.textContent = '100';
        ldBar.style.width = '100%';
        setTimeout(() => {
          loader.classList.add('done');
          playTone(523.25, 'triangle', 0.25, 0.08); // High C chime
        }, 300);
      } else {
        ldCount.textContent = String(progress).padStart(2, '0');
        ldBar.style.width = `${progress}%`;
      }
    }, 45);
  }

  /* ==========================================================================
     3. Mode Switcher & Verlet Rope Pull Cord
     ========================================================================== */
  const MODE_KEY = 'praveen-mode';
  const themeMeta = $('meta[name="theme-color"]');

  function getMode() {
    return root.getAttribute('data-mode') || 'light';
  }

  function setMode(m) {
    root.setAttribute('data-mode', m);
    themeMeta?.setAttribute('content', m === 'dark' ? '#141212' : '#E8E4E0');
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  }

  // Restore saved mode
  const savedMode = localStorage.getItem(MODE_KEY);
  if (savedMode) setMode(savedMode);

  function toggleMode() {
    const next = getMode() === 'dark' ? 'light' : 'dark';
    setMode(next);
    playTone(next === 'dark' ? 220 : 660, 'sine', 0.12, 0.08);
  }

  // Verlet Rope Simulation
  (function initPullCord() {
    const wrap = $('#cord');
    const cv = $('#cordCanvas');
    const hit = $('#cordHit');
    if (!wrap || !cv || !hit) return;

    const ctx = cv.getContext('2d');
    const N = 20; // Number of rope nodes
    let dpr = 1, W = 180, H = 320;
    let seg = 10, ax = 120;
    let pts = [];
    let grab = -1, target = null;
    let ext = 0, extV = 0;
    let dropped = true;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      W = rect.width || 180;
      H = rect.height || 320;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      ax = W * 0.65;
      const L = H * 0.65;
      seg = L / N;

      if (!pts.length) {
        for (let i = 0; i <= N; i++) {
          const x = ax;
          const y = i * seg;
          pts.push({ x, y, px: x, py: y });
        }
      } else {
        const dx = ax - pts[0].x;
        pts.forEach(p => { p.x += dx; p.px += dx; });
      }
    }
    resize();
    window.addEventListener('resize', resize);

    // Physics Update
    function physics() {
      // Free spring retraction
      if (grab < 0) {
        const K = 720, C = 22;
        extV += (-K * ext - C * extV) * (1 / 60);
        ext += extV * (1 / 60);
      }

      // Verlet nodes integration
      for (let i = 1; i <= N; i++) {
        const p = pts[i];
        if (i === grab && target) {
          p.x = target.x;
          p.y = target.y;
          continue;
        }
        const vx = (p.x - p.px) * 0.985;
        const vy = (p.y - p.py) * 0.985 + 0.35; // gravity
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy;
      }

      // Anchor node
      pts[0].x = ax;
      pts[0].y = ext;

      // Distance constraints
      for (let iter = 0; iter < 12; iter++) {
        for (let i = 0; i < N; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const diff = (dist - seg) / dist;
          const w1 = i === 0 ? 0 : 0.5;
          const w2 = (i + 1 === grab && target) ? 0 : 0.5;
          p1.x += dx * diff * w1;
          p1.y += dy * diff * w1;
          p2.x -= dx * diff * w2;
          p2.y -= dy * diff * w2;
        }
      }
    }

    // Render Canvas Rope & Tassel
    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const isDark = getMode() === 'dark';
      const cordColor = isDark ? '#A39696' : '#6B5C5C';
      const knobColor = isDark ? '#D4AF37' : '#2A2525';

      // Draw Rope
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= N; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = cordColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw Tassel / Knob at end
      const end = pts[N];
      ctx.save();
      ctx.translate(end.x, end.y);

      // Tassel cap
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = knobColor;
      ctx.fill();

      // Tassel body
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.lineTo(5, 4);
      ctx.lineTo(8, 20);
      ctx.lineTo(-8, 20);
      ctx.closePath();
      ctx.fillStyle = knobColor;
      ctx.fill();
      ctx.restore();

      // Position DOM hit button directly over knob
      hit.style.left = `${end.x}px`;
      hit.style.top = `${end.y + 10}px`;
    }

    // Main animation loop
    function loop() {
      physics();
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Mouse & Touch interaction
    let startY = 0;
    let didToggle = false;

    function onPointerDown(e) {
      const rect = cv.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      target = { x: clientX - rect.left, y: clientY - rect.top };
      grab = N;
      startY = target.y;
      didToggle = false;
      playTone(400, 'sine', 0.05, 0.03);

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
      if (grab < 0) return;
      const rect = cv.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      target.x = clientX - rect.left;
      target.y = Math.max(seg * 2, clientY - rect.top);

      // Trigger mode toggle when pulled downward significantly
      if (!didToggle && target.y - startY > 45) {
        didToggle = true;
        toggleMode();
      }
      e.preventDefault();
    }

    function onPointerUp() {
      grab = -1;
      target = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    hit.addEventListener('pointerdown', onPointerDown);
    hit.addEventListener('click', () => {
      if (!didToggle) toggleMode();
    });
  })();

  /* ==========================================================================
     4. Sticky Header Blur & Navigation
     ========================================================================== */
  const header = $('#siteHeader');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }, { passive: true });

  // Smooth scroll links
  $$('[data-go]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-go');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        playTone(320, 'sine', 0.06, 0.03);
      }
    });
  });

  /* ==========================================================================
     5. Hero Flip Calendar
     ========================================================================== */
  const calNum = $('#calNum');
  const calLabel = $('#calLabel');
  const calSub = $('#calSub');

  const skillsData = [
    { num: '01 / 04', label: 'Frontend Engineering', sub: 'React.js · JavaScript · Modern HTML5/CSS3 · Responsive UI' },
    { num: '02 / 04', label: 'AI Systems & Tools', sub: 'Care AI · Voice Triage · Python · Healthcare AI' },
    { num: '03 / 04', label: 'Hackathon Leadership', sub: 'Team Leader · Brainhack · PortGen · IIT-BHU Finalist' },
    { num: '04 / 04', label: 'Problem Solving & Stack', sub: 'SQL · C Programming · Logic & Chess Strategy' },
  ];

  let skillIndex = 0;
  setInterval(() => {
    skillIndex = (skillIndex + 1) % skillsData.length;
    const item = skillsData[skillIndex];
    if (calNum && calLabel && calSub) {
      const card = $('#heroCalendar .cal__card');
      card?.classList.add('flipping');
      setTimeout(() => {
        calNum.textContent = item.num;
        calLabel.textContent = item.label;
        calSub.textContent = item.sub;
        card?.classList.remove('flipping');
      }, 150);
    }
  }, 3800);

  /* ==========================================================================
     6. Hero Avatar Interactive Liquid Glow
     ========================================================================== */
  (function initHeroLiquid() {
    const card = $('#figCard');
    const cv = $('#figCanvas');
    if (!card || !cv) return;

    const ctx = cv.getContext('2d');
    let W = card.offsetWidth;
    let H = card.offsetHeight;
    let mx = -100, my = -100;

    function resize() {
      W = card.offsetWidth;
      H = card.offsetHeight;
      cv.width = W;
      cv.height = H;
    }
    resize();
    window.addEventListener('resize', resize);

    card.addEventListener('pointermove', e => {
      const rect = card.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    });

    card.addEventListener('pointerleave', () => {
      mx = -100;
      my = -100;
    });

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (mx > 0 && my > 0) {
        const grad = ctx.createRadialGradient(mx, my, 10, mx, my, 140);
        grad.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
        grad.addColorStop(0.5, 'rgba(212, 175, 55, 0.1)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  })();

  /* ==========================================================================
     7. 3D Doors & Project Showcase
     ========================================================================== */
  const DOORS_INFO = [
    {
      title: 'Web & Frontend Development',
      sub: 'Modern, reactive web applications with clean architecture',
      skills: ['React.js & Component Design', 'HTML5 & Modern CSS3', 'JavaScript (ES6+)', 'Responsive UI/UX'],
      projects: [
        {
          name: 'PortGen – AI Portfolio & Resume Builder',
          role: 'Team Leader & Frontend Architect',
          desc: 'An AI-powered web platform enabling users and students to generate high-converting, professional portfolios and resumes in minutes without any coding or design hassle.',
          tags: ['React.js', 'Generative UI', 'Component System', 'CSS3 Modules'],
          github: 'https://github.com/Praveenpandit315/Port_genz'
        },
        {
          name: 'High-Performance Web Interfaces',
          role: 'Frontend Developer',
          desc: 'Production-ready responsive layouts, interactive widgets, state management architectures, and cross-browser optimized interfaces.',
          tags: ['Frontend Architecture', 'Web Standards', 'Performance', 'Git'],
          github: 'https://github.com/Praveenpandit315'
        }
      ]
    },
    {
      title: 'AI Systems & Full Stack',
      sub: 'Intelligent triage, voice recognition and medical assistant solutions',
      skills: ['AI Voice Symptom Analysis', 'Python Programming', 'SQL Databases', 'RESTful Endpoints'],
      projects: [
        {
          name: 'Care AI – Your Health Guardian',
          role: 'Team Leader & Frontend Developer',
          desc: 'An AI-driven healthcare system allowing patients to analyze symptoms through voice and text input, assess potential health risks, track medical logs, and get smart recommendations for medicines and nearby hospitals.',
          tags: ['React', 'Web Speech API', 'Healthcare AI', 'Team Brainhack'],
          github: 'https://github.com/Praveenpandit315/brainhack'
        },
        {
          name: 'Python Software Utilities',
          role: 'Software Developer',
          desc: 'Backend scripts, data manipulation workflows, and algorithm implementations built with Python and SQL.',
          tags: ['Python', 'SQL', 'Data Triaging', 'Automation'],
          github: 'https://github.com/Praveenpandit315'
        }
      ]
    },
    {
      title: 'Tools & Productivity Suite',
      sub: 'Professional mastery of modern office workflows and development tooling',
      skills: ['Microsoft Office Specialist (Master)', 'MS Word, Excel, PowerPoint', 'Git & GitHub', 'VS Code & CLI'],
      projects: [
        {
          name: 'Microsoft Office Specialist Mastery',
          role: 'Udemy Certified Expert',
          desc: 'Comprehensive expertise in advanced data processing with MS Excel (formulas, pivot tables, lookup operations), executive documentation in MS Word, and high-impact presentations in MS PowerPoint.',
          tags: ['MS Excel', 'MS Word', 'MS PowerPoint', 'Data Management'],
          github: 'https://github.com/Praveenpandit315'
        },
        {
          name: 'Engineering Tooling & Workflow',
          role: 'Developer',
          desc: 'Proficient with Git version control, collaborative code reviews, command line environments, and modern developer toolchains.',
          tags: ['Git', 'GitHub', 'CLI', 'Documentation'],
          github: 'https://github.com/Praveenpandit315'
        }
      ]
    },
    {
      title: 'Hackathons & Leadership',
      sub: 'Rapid prototyping, team leadership, and competitive strategy',
      skills: ['IIT-BHU Serve-Smart Hackathon', 'CodeShastra Talentine', 'SDGI SGU Hackathon', 'Synergix Buildstation'],
      projects: [
        {
          name: 'National Hackathon Sprint (2025–2026)',
          role: 'Team Leader',
          desc: 'Led Team Brainhack across multiple prestigious university hackathons: IIT BHU Serve-Smart Hackathon, CodeShastra Talentine, SDGI Global University (Ghaziabad) Hackathon, and Builder Base Synergix Buildstation.',
          tags: ['Hackathon Finalist', 'Team Leadership', 'Fast Delivery', 'Unstop Awards'],
          github: 'https://github.com/Praveenpandit315/brainhack'
        },
        {
          name: 'GLA TechQuest Distinction',
          role: 'Participant & Winner',
          desc: 'Recognized for computer science excellence and problem solving in the university-wide TechQuest challenge at GLA University.',
          tags: ['GLA University', 'Problem Solving', 'Algorithm Quiz', 'Achievement'],
          github: 'https://github.com/Praveenpandit315'
        }
      ]
    }
  ];

  const dinfo = $('#dinfo');
  const dinfoH = $('.dinfo__h', dinfo);
  const dinfoT = $('.dinfo__t', dinfo);
  const dinfoP = $('.dinfo__p', dinfo);
  const doorUnits = $$('.unit');
  const doorModal = $('#doorModal');
  const doorModalBody = $('#doorModalBody');
  const doorModalClose = $('#doorModalClose');
  const doorModalScrim = $('#doorModalScrim');

  function updateDoorInfo(idx) {
    const data = DOORS_INFO[idx];
    if (!data || !dinfo) return;
    dinfoH.textContent = data.title;
    dinfoT.textContent = data.sub;
    dinfoP.innerHTML = data.skills.map(s => `<li>${s}</li>`).join('');
  }

  function openDoorModal(idx) {
    const data = DOORS_INFO[idx];
    if (!data || !doorModal || !doorModalBody) return;

    doorModalBody.innerHTML = `
      <div class="dm-head">
        <span class="eyebrow">Skill Door ${idx + 1} of 4</span>
        <h2 class="dm-title" id="doorModalTitle">${data.title}</h2>
        <p class="dm-desc">${data.sub}</p>
      </div>
      <div class="project-grid">
        ${data.projects.map(p => `
          <div class="p-card">
            <div>
              <span class="p-card__tag">Featured Project</span>
              <h3 class="p-card__name">${p.name}</h3>
              <span class="p-card__role">${p.role}</span>
              <p class="p-card__desc">${p.desc}</p>
              <div class="p-card__tags">
                ${p.tags.map(t => `<span>${t}</span>`).join('')}
              </div>
            </div>
            <div class="p-card__links">
              <a href="${p.github}" target="_blank" rel="noopener noreferrer" class="pill pill--primary">
                <span class="pill__in">View on GitHub ↗</span>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    doorModal.removeAttribute('hidden');
    playTone(480, 'triangle', 0.15, 0.06);
    document.body.style.overflow = 'hidden';
  }

  function closeDoorModal() {
    doorModal?.setAttribute('hidden', '');
    document.body.style.overflow = '';
    doorUnits.forEach(u => u.classList.remove('open'));
  }

  doorModalClose?.addEventListener('click', closeDoorModal);
  doorModalScrim?.addEventListener('click', closeDoorModal);

  // Hook door interactions
  doorUnits.forEach((unit, idx) => {
    const btn = unit.querySelector('.doorway');
    if (!btn) return;

    btn.addEventListener('mouseenter', () => {
      updateDoorInfo(idx);
      playTone(340 + idx * 40, 'sine', 0.04, 0.02);
    });

    btn.addEventListener('focus', () => {
      updateDoorInfo(idx);
    });

    btn.addEventListener('click', () => {
      unit.classList.add('open');
      playTone(520, 'sine', 0.1, 0.05);
      setTimeout(() => openDoorModal(idx), 220);
    });
  });

  // Footer link buttons to open specific doors
  $$('[data-open-door]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-open-door'), 10);
      openDoorModal(idx);
    });
  });

  /* ==========================================================================
     8. 3D Time Tunnel & Story Section
     ========================================================================== */
  (function initStoryTunnel() {
    const sec = $('#story');
    const cv = $('#storyCanvas');
    const storyLine = $('#storyLine');
    const storyWhen = $('#storyWhen');
    const storyCount = $('#storyCount');
    const dgCols = $$('.dg__c');
    const chapters = $$('.ch');

    if (!sec || !cv) return;
    const ctx = cv.getContext('2d');
    let W = cv.offsetWidth;
    let H = cv.offsetHeight;

    function resize() {
      W = cv.offsetWidth;
      H = cv.offsetHeight;
      cv.width = W;
      cv.height = H;
    }
    resize();
    window.addEventListener('resize', resize);

    // Tunnel Rings & Particles
    const RINGS = 14;
    const rings = Array.from({ length: RINGS }, (_, i) => ({ z: (i + 1) * 70 }));
    const stars = Array.from({ length: 60 }, () => ({
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 500,
      z: Math.random() * 800
    }));

    let scrollProgress = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const isDark = getMode() === 'dark';
      const strokeColor = isDark ? 'rgba(212, 175, 55, 0.25)' : 'rgba(90, 75, 75, 0.2)';

      // Draw Rings
      rings.forEach(r => {
        const factor = 400 / (r.z || 1);
        const radius = Math.max(1, 140 * factor);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.min(3, 1.2 * factor);
        ctx.stroke();

        // Animate ring toward camera with scroll
        r.z -= 0.6 + scrollProgress * 1.5;
        if (r.z <= 30) r.z = RINGS * 70;
      });

      // Draw dust
      ctx.fillStyle = isDark ? '#D4AF37' : '#857878';
      stars.forEach(s => {
        const factor = 350 / (s.z || 1);
        const sx = cx + s.x * factor;
        const sy = cy + s.y * factor;
        if (sx > 0 && sx < W && sy > 0 && sy < H) {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.5, 1.4 * factor), 0, Math.PI * 2);
          ctx.fill();
        }
        s.z -= 0.8 + scrollProgress * 2;
        if (s.z <= 20) s.z = 800;
      });

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    // Scroll Observer for Chapters & Odometer
    function onScroll() {
      const rect = sec.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const current = Math.max(0, -rect.top);
      scrollProgress = Math.min(1, Math.max(0, current / (total || 1)));

      // Update line
      if (storyLine) storyLine.style.width = `${Math.round(scrollProgress * 100)}%`;

      // Find active chapter based on viewport
      chapters.forEach((ch, idx) => {
        const chRect = ch.getBoundingClientRect();
        if (chRect.top < window.innerHeight * 0.6 && chRect.bottom > window.innerHeight * 0.2) {
          chapters.forEach(c => c.classList.remove('on'));
          ch.classList.add('on');

          // Update year odometer
          const year = ch.getAttribute('data-y') || '2026';
          const when = ch.getAttribute('data-when') || '';
          if (storyWhen) storyWhen.textContent = when;
          if (storyCount) storyCount.textContent = String(idx + 1).padStart(2, '0');

          // Roll digits
          year.split('').forEach((d, k) => {
            if (dgCols[k]) dgCols[k].style.setProperty('--d', d);
          });
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ==========================================================================
     9. 3D Holographic Ability Card Physics & Flip
     ========================================================================== */
  (function initHoloCard() {
    const card = $('#hc');
    if (!card) return;

    let isFlipped = false;
    let isInteracting = false;

    function handlePointerMove(e) {
      if (isFlipped) return; // standard back view
      const rect = card.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

      const px = (x / rect.width - 0.5) * 2;
      const py = (y / rect.height - 0.5) * 2;

      const rx = -py * 14;
      const ry = px * 16;

      card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03, 1.03, 1.03)`;

      // Specular sheen & glare coordinates
      card.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
      card.style.setProperty('--my', `${(y / rect.height) * 100}%`);
    }

    function resetCard() {
      if (!isFlipped) {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      }
    }

    card.addEventListener('pointermove', handlePointerMove);
    card.addEventListener('pointerleave', resetCard);

    // Tap to flip
    card.addEventListener('click', () => {
      isFlipped = !isFlipped;
      card.classList.toggle('flip', isFlipped);
      playTone(isFlipped ? 520 : 380, 'sine', 0.1, 0.05);
      if (isFlipped) {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(180deg)';
      } else {
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
      }
    });

    // Holo trigger button in hero scrolls down to card
    const holoOpen = $('#holoOpen');
    holoOpen?.addEventListener('click', () => {
      const section = $('#abilityCardSection');
      section?.scrollIntoView({ behavior: 'smooth' });
      playTone(440, 'triangle', 0.1, 0.04);
    });
  })();

  /* ==========================================================================
     10. Contact Modal & Fast Actions
     ========================================================================== */
  const contactModal = $('#contactModal');
  const contactClose = $('#contactClose');
  const contactScrim = $('#contactScrim');
  const copyEmailBtn = $('#copyEmailBtn');

  function openContactModal() {
    contactModal?.removeAttribute('hidden');
    playTone(460, 'sine', 0.1, 0.05);
    document.body.style.overflow = 'hidden';
  }

  function closeContactModal() {
    contactModal?.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  $$('[data-contact]').forEach(b => b.addEventListener('click', openContactModal));
  contactClose?.addEventListener('click', closeContactModal);
  contactScrim?.addEventListener('click', closeContactModal);

  // Copy Email to Clipboard
  copyEmailBtn?.addEventListener('click', () => {
    const email = copyEmailBtn.getAttribute('data-copy');
    if (!email) return;
    navigator.clipboard?.writeText(email).then(() => {
      const original = copyEmailBtn.querySelector('span')?.textContent || 'Copy';
      const span = copyEmailBtn.querySelector('span');
      if (span) span.textContent = 'Copied! ✓';
      playTone(660, 'sine', 0.1, 0.06);
      setTimeout(() => {
        if (span) span.textContent = original;
      }, 2000);
    });
  });

  // Contact Form Submission (direct mailto prefill)
  window.handleContactSubmit = function (e) {
    e.preventDefault();
    const name = $('#fName')?.value || '';
    const email = $('#fEmail')?.value || '';
    const message = $('#fMessage')?.value || '';

    const subject = encodeURIComponent(`Project Inquiry from ${name}`);
    const body = encodeURIComponent(`Hi Praveen,\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\nBest regards,\n${name}`);
    window.location.href = `mailto:PraveenGautam433603@gmail.com?subject=${subject}&body=${body}`;
    closeContactModal();
  };

  /* ==========================================================================
     11. Live Clock & Local Time (IST)
     ========================================================================== */
  function updateClock() {
    const now = new Date();
    // India is UTC + 5:30
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    let hours = ist.getHours();
    const mins = String(ist.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;

    $$('[data-ftime]').forEach(el => {
      el.textContent = `${hours}:${mins}${ampm}`;
    });
    $$('[data-fyear]').forEach(el => {
      el.textContent = ist.getFullYear();
    });
  }
  updateClock();
  setInterval(updateClock, 15000);

  /* ==========================================================================
     12. Edge-to-Edge Dynamic Footer Sizing
     ========================================================================== */
  function fitFooterWord() {
    const f = $('.sf');
    const word = $('#sfWord');
    if (!f || !word) return;

    const span = $('.full', word);
    if (!span) return;

    word.style.setProperty('--wf', '100px');
    const currentWidth = span.getBoundingClientRect().width;
    if (currentWidth > 0) {
      const targetWidth = f.clientWidth * 0.94;
      const scale = targetWidth / currentWidth;
      f.style.setProperty('--wf', `${(100 * scale).toFixed(2)}px`);
    }
    word.style.removeProperty('--wf');
  }

  fitFooterWord();
  window.addEventListener('resize', fitFooterWord);
  if (document.fonts) document.fonts.ready.then(fitFooterWord);

  /* ==========================================================================
     13. Back to Top with Circular Scroll Progress
     ========================================================================== */
  const toTop = $('#toTop');
  const ringCircle = toTop?.querySelector('.ring circle');
  const circumference = 150.8; // 2 * PI * r (r=24)

  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const progress = total > 0 ? Math.min(1, window.scrollY / total) : 0;

    if (toTop) {
      if (window.scrollY > 400) {
        toTop.classList.add('show');
      } else {
        toTop.classList.remove('show');
      }
    }

    if (ringCircle) {
      const offset = circumference - (progress * circumference);
      ringCircle.style.strokeDashoffset = offset;
    }
  }, { passive: true });

  /* ==========================================================================
     14. Keyboard Controls (F for Fullscreen, Esc to close modals)
     ========================================================================== */
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeContactModal();
      closeDoorModal();
    }
    if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  });

})();
