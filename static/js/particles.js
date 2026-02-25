/* ============================================
   DON Q — Neural Network Particle System
   Gold + blue floating nodes with connections
   ============================================ */

(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const isHome = document.body.classList.contains('home');

  // Config
  const CONFIG = {
    particleCount: isHome ? 60 : 25,
    maxSpeed: 0.3,
    connectionDistance: 150,
    particleMinSize: 1,
    particleMaxSize: 3,
    // Gold and blue accent colors matching the brand
    colors: [
      'rgba(221, 180, 96, ',   // gold-bright
      'rgba(176, 136, 53, ',   // gold-mid
      'rgba(139, 101, 32, ',   // gold-dim
      'rgba(160, 200, 245, ',  // blue-accent
    ],
    connectionColor: isHome
      ? 'rgba(180, 140, 70, '
      : 'rgba(180, 140, 70, ',
    baseOpacity: isHome ? 1 : 0.4,
    connectionOpacity: isHome ? 0.08 : 0.03,
    pulseNodes: true,
  };

  let particles = [];
  let w, h;
  let animationId;
  let mouse = { x: null, y: null, radius: 120 };

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * CONFIG.maxSpeed;
      this.vy = (Math.random() - 0.5) * CONFIG.maxSpeed;
      this.size = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);
      this.colorIndex = Math.random() < 0.2 ? 3 : Math.floor(Math.random() * 3); // 20% chance blue
      this.baseAlpha = (0.3 + Math.random() * 0.7) * CONFIG.baseOpacity;
      this.alpha = this.baseAlpha;
      this.pulseOffset = Math.random() * Math.PI * 2;
      this.pulseSpeed = 0.005 + Math.random() * 0.01;
    }

    update(time) {
      this.x += this.vx;
      this.y += this.vy;

      // Wrap around edges
      if (this.x < -10) this.x = w + 10;
      if (this.x > w + 10) this.x = -10;
      if (this.y < -10) this.y = h + 10;
      if (this.y > h + 10) this.y = -10;

      // Gentle pulse
      if (CONFIG.pulseNodes) {
        this.alpha = this.baseAlpha * (0.6 + 0.4 * Math.sin(time * this.pulseSpeed + this.pulseOffset));
      }

      // Mouse interaction — gentle push
      if (mouse.x !== null) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius * 0.02;
          this.vx += dx / dist * force;
          this.vy += dy / dist * force;
        }
      }

      // Dampen velocity
      this.vx *= 0.999;
      this.vy *= 0.999;
    }

    draw() {
      const color = CONFIG.colors[this.colorIndex];
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = color + this.alpha + ')';
      ctx.fill();

      // Glow effect for brighter particles
      if (this.alpha > 0.5 && this.size > 2) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = color + (this.alpha * 0.1) + ')';
        ctx.fill();
      }
    }
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.connectionDistance) {
          const opacity = (1 - dist / CONFIG.connectionDistance) * CONFIG.connectionOpacity;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = CONFIG.connectionColor + opacity + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new Particle());
    }
  }

  let time = 0;
  function animate() {
    time++;
    ctx.clearRect(0, 0, w, h);
    drawConnections();
    for (const p of particles) {
      p.update(time);
      p.draw();
    }
    animationId = requestAnimationFrame(animate);
  }

  // Event listeners
  window.addEventListener('resize', () => {
    resize();
    // Reinit if particle count is too low for new size
    if (particles.length < CONFIG.particleCount * 0.5) {
      init();
    }
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Reduce animation when tab not visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else {
      animate();
    }
  });

  // Start
  init();
  animate();
})();
