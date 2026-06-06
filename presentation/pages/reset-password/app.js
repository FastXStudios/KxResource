
// ── Configuración ─────────────────────────────────────
const CONFIG = {
    API_BASE: 'https://kxback-t12o.onrender.com',
    MAX_ATTEMPTS: 3,
    ATTEMPT_WINDOW_MS: 10 * 60 * 1000, // 10 min
    INACTIVITY_MS: 15 * 60 * 1000,     // 15 min
  };
  
  // ── Estado global ──────────────────────────────────────
  const State = {
    token: null,
    submitting: false,
    attempts: 0,
    attemptTimestamp: null,
    inactivityTimer: null,
  };
  
  // ── Refs DOM ──────────────────────────────────────────
  const $ = id => document.getElementById(id);
  
  const refs = {
    stateLoading: $('state-loading'),
    stateInvalid: $('state-invalid'),
    stateForm:    $('state-form'),
    stateSuccess: $('state-success'),
    invalidMsg:   $('invalid-message'),
    password:     $('password'),
    confirm:      $('confirm'),
    togglePass:   $('togglePass'),
    toggleConf:   $('toggleConfirm'),
    seg1: $('seg1'), seg2: $('seg2'),
    seg3: $('seg3'), seg4: $('seg4'),
    strengthLabel: $('password-strength-desc'),
    matchError:   $('match-error'),
    apiError:     $('api-error'),
    submitBtn:    $('submit-btn'),
    submitLabel:  document.querySelector('.btn-label'),
    submitSpinner:document.querySelector('.btn-spinner'),
  };
  
  // ── Partículas flotantes ──────────────────────────────
  function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
  
    const ctx = canvas.getContext('2d');
    let W, H, particles;
  
    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
  
    function makeParticle() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        r: Math.random() * 1.5 + 0.4,
        alpha: Math.random() * 0.4 + 0.05,
        hue: Math.random() < 0.5 ? 248 : 180, // violet / teal
      };
    }
  
    function init() {
      resize();
      const count = Math.min(Math.floor((W * H) / 12000), 120);
      particles = Array.from({ length: count }, makeParticle);
    }
  
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
  
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.alpha})`;
        ctx.fill();
      }
  
      // Líneas de conexión
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(108,99,255,${0.06 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
  
      requestAnimationFrame(draw);
    }
  
    window.addEventListener('resize', init);
    init();
    draw();
  }
  
  // ── Mouse glow en botón ───────────────────────────────
  function initButtonGlow() {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        btn.style.setProperty('--mx', `${x}%`);
        btn.style.setProperty('--my', `${y}%`);
      });
    });
  }
  
  // ── Leer token ────────────────────────────────────────
  function extractToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
  
    // Limpiar URL del historial para no exponer el token
    try {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    } catch (_) {}
  
    return token.trim();
  }
  
  function isTokenFormatValid(token) {
    // Espera hex de 64 chars (SHA-256) o alfanumérico generado por tu back
    return token.length >= 32 && token.length <= 256 && /^[a-f0-9]+$/i.test(token);
  }
  
  // ── Transición de estados ──────────────────────────────
  function showState(name) {
    const all = ['state-loading', 'state-invalid', 'state-form', 'state-success'];
    all.forEach(id => {
      const el = $(id);
      if (id === `state-${name}`) {
        el.classList.remove('hidden');
        el.style.animation = 'none';
        requestAnimationFrame(() => {
          el.style.animation = '';
        });
      } else {
        el.classList.add('hidden');
      }
    });
  }
  
  // ── Fortaleza de contraseña ───────────────────────────
  const RULES = {
    len:     p => p.length >= 8,
    upper:   p => /[A-Z]/.test(p),
    lower:   p => /[a-z]/.test(p),
    num:     p => /[0-9]/.test(p),
    special: p => /[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?`~]/.test(p),
  };
  
  const STRENGTH_LABELS = ['', 'Débil', 'Regular', 'Buena', 'Excelente'];
  const STRENGTH_COLORS = ['', '#ff5f6d', '#f5a623', '#6C63FF', '#3ECFCF'];
  
  function evaluateStrength(pass) {
    const met = Object.values(RULES).map(fn => fn(pass));
    const score = met.filter(Boolean).length; // 0–5
    const normalized = Math.min(Math.floor(score / 5 * 4) + (score > 0 ? 1 : 0), 4);
    return { score: normalized, met };
  }
  
  function updateStrengthUI(pass) {
    const { score, met } = evaluateStrength(pass);
    const segs = [refs.seg1, refs.seg2, refs.seg3, refs.seg4];
    const color = score > 0 ? STRENGTH_COLORS[score] : 'var(--surface-2)';
  
    segs.forEach((seg, i) => {
      seg.style.background = i < score ? color : 'var(--surface-2)';
      seg.style.transition = 'background 0.3s';
    });
  
    refs.strengthLabel.textContent = pass.length > 0 ? STRENGTH_LABELS[score] : '';
    refs.strengthLabel.style.color = color;
  
    // Actualizar items de requisitos
    const ruleKeys = Object.keys(RULES);
    ruleKeys.forEach((key, i) => {
      const item = $(`req-${key}`);
      if (!item) return;
      if (met[i]) {
        item.classList.add('met');
        item.querySelector('svg').innerHTML = '<circle cx="8" cy="8" r="7" fill="currentColor" stroke="none"/><polyline points="5,8.5 7.5,11 11,6" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
      } else {
        item.classList.remove('met');
        item.querySelector('svg').innerHTML = '<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4" fill="none"/>';
      }
    });
  
    return { score, allMet: met.every(Boolean) };
  }
  
  // ── Toggle visibilidad contraseña ─────────────────────
  function togglePassword(input, btn) {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.eye-icon').classList.toggle('hidden', isHidden);
    btn.querySelector('.eye-off-icon').classList.toggle('hidden', !isHidden);
    btn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
  }
  
  // ── Validación en tiempo real ─────────────────────────
  let formValid = false;
  
  function validateForm() {
    const pass = refs.password.value;
    const conf = refs.confirm.value;
  
    const { score, allMet } = updateStrengthUI(pass);
  
    // Validar coincidencia
    const matchOk = pass === conf;
    if (conf.length > 0) {
      refs.matchError.classList.toggle('hidden', matchOk);
      refs.confirm.classList.toggle('invalid', !matchOk);
      refs.confirm.classList.toggle('valid', matchOk && conf.length > 0);
    } else {
      refs.matchError.classList.add('hidden');
      refs.confirm.classList.remove('invalid', 'valid');
    }
  
    // Campo password
    if (pass.length > 0) {
      refs.password.classList.toggle('valid', allMet);
      refs.password.classList.toggle('invalid', !allMet && pass.length > 2);
    } else {
      refs.password.classList.remove('valid', 'invalid');
    }
  
    formValid = allMet && matchOk && conf.length > 0;
    refs.submitBtn.disabled = !formValid;
  }
  
  // ── Rate limiting local ───────────────────────────────
  function isRateLimited() {
    const now = Date.now();
    if (
      State.attemptTimestamp &&
      now - State.attemptTimestamp < CONFIG.ATTEMPT_WINDOW_MS &&
      State.attempts >= CONFIG.MAX_ATTEMPTS
    ) {
      const remainMins = Math.ceil((CONFIG.ATTEMPT_WINDOW_MS - (now - State.attemptTimestamp)) / 60000);
      return { limited: true, remainMins };
    }
    return { limited: false };
  }
  
  function recordAttempt() {
    const now = Date.now();
    if (!State.attemptTimestamp || now - State.attemptTimestamp >= CONFIG.ATTEMPT_WINDOW_MS) {
      State.attemptTimestamp = now;
      State.attempts = 0;
    }
    State.attempts++;
  }
  
  // ── Inactividad ───────────────────────────────────────
  function resetInactivityTimer() {
    clearTimeout(State.inactivityTimer);
    State.inactivityTimer = setTimeout(() => {
      showState('invalid');
      refs.invalidMsg.textContent = 'Sesión expirada por inactividad. Solicita un nuevo enlace.';
      State.token = null;
    }, CONFIG.INACTIVITY_MS);
  }
  
  function startInactivityWatch() {
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => {
      document.addEventListener(ev, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();
  }
  
  // ── Mostrar error de API ──────────────────────────────
  function showApiError(msg) {
    refs.apiError.textContent = msg;
    refs.apiError.classList.remove('hidden');
    refs.apiError.style.animation = 'none';
    requestAnimationFrame(() => {
      refs.apiError.style.animation = 'fadeUp 0.3s ease both';
    });
  }
  function clearApiError() {
    refs.apiError.textContent = '';
    refs.apiError.classList.add('hidden');
  }
  
  // ── Enviar formulario ─────────────────────────────────
  async function submitReset() {
    if (State.submitting || !formValid || !State.token) return;
  
    const rl = isRateLimited();
    if (rl.limited) {
      showApiError(`Demasiados intentos. Espera ${rl.remainMins} minuto(s) antes de volver a intentarlo.`);
      return;
    }
  
    clearApiError();
    State.submitting = true;
    refs.submitBtn.disabled = true;
    refs.submitLabel.classList.add('hidden');
    refs.submitSpinner.classList.remove('hidden');
  
    recordAttempt();
  
    const password = refs.password.value;
  
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: State.token, password }),
        credentials: 'omit',
      });
  
      // Limpiar contraseña de memoria lo antes posible
      refs.password.value = '';
      refs.confirm.value = '';
      State.token = null;
  
      let data = {};
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try { data = await res.json(); } catch (_) {}
      }
  
      if (res.ok) {
        clearTimeout(State.inactivityTimer);
        showState('success');
      } else {
        // No revelar info sensible
        if (res.status === 400 || res.status === 410 || res.status === 404) {
          showState('invalid');
          refs.invalidMsg.textContent = 'Este enlace ya no es válido o ha expirado. Solicita uno nuevo.';
        } else if (res.status === 429) {
          showApiError('Demasiadas solicitudes. Espera unos minutos.');
        } else {
          showApiError('Ocurrió un error. Por favor intenta de nuevo.');
        }
      }
    } catch (err) {
      // Error de red u otro: no revelar detalles
      showApiError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      State.submitting = false;
      refs.submitLabel.classList.remove('hidden');
      refs.submitSpinner.classList.add('hidden');
      refs.submitBtn.disabled = !formValid;
    }
  }
  
  // ── Sin redirección: app de escritorio WPF ────────────
  // El usuario cierra la ventana del navegador manualmente.
  
  // ── Arranque principal ────────────────────────────────
  async function main() {
    initParticles();
    initButtonGlow();
  
    // Mostrar estado loading
    showState('loading');
  
    // Extraer y validar token
    const rawToken = extractToken();
  
    if (!rawToken || !isTokenFormatValid(rawToken)) {
      // Token ausente o mal formado — mostrar error genérico
      setTimeout(() => {
        showState('invalid');
        refs.invalidMsg.textContent = 'El enlace de recuperación no es válido o está incompleto.';
      }, 600);
      return;
    }
  
    // Guardar en estado interno solamente
    State.token = rawToken;
  
    // Pequeña pausa UX + iniciar vigilancia de inactividad
    await new Promise(r => setTimeout(r, 700));
    showState('form');
    startInactivityWatch();
  
    // ── Eventos del formulario ──────────────────────────
    refs.password.addEventListener('input', validateForm);
    refs.confirm.addEventListener('input', validateForm);
  
    refs.togglePass.addEventListener('click', () =>
      togglePassword(refs.password, refs.togglePass)
    );
    refs.toggleConf.addEventListener('click', () =>
      togglePassword(refs.confirm, refs.toggleConf)
    );
  
    refs.submitBtn.addEventListener('click', submitReset);
  
    // Enviar con Enter
    [refs.password, refs.confirm].forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && formValid && !State.submitting) submitReset();
      });
    });
  
    // Prevenir pegar en confirmar (opcional, UX)
    refs.confirm.addEventListener('paste', e => e.preventDefault());
  
    // Prevenir click derecho inspect en inputs (defensa superficial)
    [refs.password, refs.confirm].forEach(i => {
      i.addEventListener('contextmenu', e => e.preventDefault());
    });
  
    // El flujo de "solicitar nuevo enlace" se hace desde la app WPF.
  }
  
  // ── Defensa: deshabilitar devtools básico (no infalible) ──
  (function guardDevtools() {
    let devOpen = false;
    const threshold = 160;
    setInterval(() => {
      const wDiff = window.outerWidth - window.innerWidth;
      const hDiff = window.outerHeight - window.innerHeight;
      if (wDiff > threshold || hDiff > threshold) {
        if (!devOpen) {
          devOpen = true;
          // Limpiar token de memoria si hay herramientas abiertas
          State.token = null;
        }
      } else {
        devOpen = false;
      }
    }, 1000);
  })();
  
  // ── No logs de token en consola ───────────────────────
  const _origLog = console.log;
  console.log = (...args) => {
    const str = args.map(a => String(a)).join(' ');
    if (/token|password|pass|secret/i.test(str)) return;
    _origLog(...args);
  };
  
  // ── Arranque ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', main);