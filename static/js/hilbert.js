// Hilbert Space-Filling Curve Animation
// Draws progressively, then subtly pulses

(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'hilbert-canvas';
  const hero = document.querySelector('.hero');
  if (!hero) return;
  hero.style.position = 'relative';
  hero.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width, height, points, animFrame;
  const ORDER = 6; // 2^6 = 64x64 grid = 4096 points
  const DRAW_SPEED = 12; // points per frame
  let drawn = 0;
  let phase = 'drawing'; // 'drawing' | 'pulsing'
  let pulseTime = 0;

  function resize() {
    const rect = hero.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    points = generateHilbert(ORDER);
    drawn = phase === 'pulsing' ? points.length : drawn;
  }

  // Convert (d, order) -> (x, y) via Hilbert curve
  function d2xy(order, d) {
    let x = 0, y = 0;
    let rx, ry, s, t = d;
    for (s = 1; s < (1 << order); s *= 2) {
      rx = 1 & (t / 2);
      ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
        let tmp = x; x = y; y = tmp;
      }
      x += s * rx;
      y += s * ry;
      t = Math.floor(t / 4);
    }
    return { x, y };
  }

  function generateHilbert(order) {
    const n = 1 << order;
    const total = n * n;
    const pts = [];
    // Compute curve size to fit nicely in hero
    const size = Math.min(width, height) * 0.7;
    const offsetX = (width - size) / 2;
    const offsetY = (height - size) / 2;
    const step = size / (n - 1);

    for (let i = 0; i < total; i++) {
      const { x, y } = d2xy(order, i);
      pts.push({
        x: offsetX + x * step,
        y: offsetY + y * step
      });
    }
    return pts;
  }

  function drawCurve() {
    ctx.clearRect(0, 0, width, height);
    if (!points || points.length < 2) return;

    const count = Math.min(drawn, points.length);

    // Base curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < count; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    let alpha;
    if (phase === 'drawing') {
      alpha = 0.12;
    } else {
      // Subtle pulse between 0.06 and 0.14
      alpha = 0.10 + 0.04 * Math.sin(pulseTime * 0.8);
    }

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bright tip during drawing
    if (phase === 'drawing' && count > 1) {
      const tipLen = Math.min(80, count);
      ctx.beginPath();
      ctx.moveTo(points[count - tipLen].x, points[count - tipLen].y);
      for (let i = count - tipLen + 1; i < count; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glow dot at tip
      const tip = points[count - 1];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    }
  }

  function animate() {
    if (phase === 'drawing') {
      drawn += DRAW_SPEED;
      if (drawn >= points.length) {
        drawn = points.length;
        phase = 'pulsing';
      }
    } else {
      pulseTime += 0.016;
    }
    drawCurve();
    animFrame = requestAnimationFrame(animate);
  }

  // Scroll-triggered fade-in animation
  function initScrollAnimations() {
    const els = document.querySelectorAll('[data-animate]');
    if (!els.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = entry.target.dataset.delay || 0;
          setTimeout(() => {
            entry.target.classList.add('animate-visible');
          }, Number(delay));
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(el => observer.observe(el));
  }

  window.addEventListener('resize', () => {
    resize();
    drawCurve();
  });

  resize();
  animate();
  initScrollAnimations();
})();
