/* ==========================================
   TROYMBA — Main Script
   Оплата идёт через бэкенд /api/create-order
   (секреты FreeKassa хранятся в .env на сервере)
   ========================================== */

/* Данные о тарифах */
const PLANS = {
  starter:      { name: 'Стартовый',        details: '1 000 запросов · 30 дней', price: 200  },
  professional: { name: 'Профессиональный', details: '3 000 запросов · 60 дней', price: 500  },
  business:     { name: 'Бизнес',           details: '7 000 запросов · 90 дней', price: 1000 },
};

let currentPlanKey = null;

/* ==========================================
   PAYMENT MODAL
   ========================================== */

/** Открыть модал оплаты */
function openPayment(planKey, price) {
  const plan = PLANS[planKey];
  if (!plan) return;
  currentPlanKey = planKey;

  document.getElementById('payModalPlanName').textContent    = plan.name;
  document.getElementById('payModalPlanDetails').textContent = plan.details;
  document.getElementById('payModalTotal').textContent       = price.toLocaleString('ru-RU') + ' ₽';
  document.getElementById('payBtnAmount').textContent        = price.toLocaleString('ru-RU');
  document.getElementById('payEmail').value = '';

  hideNotice(document.getElementById('payNotice'));
  openModal('paymentModal');
}

/**
 * Обработчик формы оплаты.
 * Вызывает бэкенд POST /api/create-order → получает URL → редирект на FreeKassa.
 */
async function handleFKPayment(e) {
  e.preventDefault();
  if (!currentPlanKey) return;

  const email  = document.getElementById('payEmail').value.trim();
  const notice = document.getElementById('payNotice');
  const btn    = document.getElementById('payBtn');

  if (!email) {
    showNotice(notice, 'error', 'Введите email для чека.');
    return;
  }

  // Блокируем кнопку, показываем загрузку
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></span> Создание заказа...';

  try {
    const res = await fetch('/api/create-order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ planKey: currentPlanKey, email }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      showNotice(notice, 'error', data.error ?? 'Ошибка сервера. Попробуйте позже.');
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      return;
    }

    // Редирект на страницу оплаты FreeKassa
    window.location.href = data.url;

  } catch (err) {
    showNotice(notice, 'error', 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.');
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

/* ==========================================
   AUTH MODAL
   ========================================== */

function switchAuth(mode) {
  const isLogin = mode === 'login';
  document.getElementById('loginForm').style.display    = isLogin ? '' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none' : '';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabReg').classList.toggle('active', !isLogin);
  hideNotice(document.getElementById('authNotice'));
}

function handleLogin(e) {
  e.preventDefault();
  showNotice(document.getElementById('authNotice'), 'success', 'Функция входа будет реализована при подключении бэкенда.');
}

function handleRegister(e) {
  e.preventDefault();
  showNotice(document.getElementById('authNotice'), 'success', 'Функция регистрации будет реализована при подключении бэкенда.');
}

/* ==========================================
   MODAL SYSTEM
   ========================================== */

function openModal(id, tab) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  document.body.style.overflow = 'hidden';
  if (tab) switchAuth(tab);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  document.body.style.overflow = '';
}

/* Close on overlay click */
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

/* Close on ESC */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    closeMobileNav();
  }
});

/* ==========================================
   MOBILE NAV
   ========================================== */

function closeMobileNav() {
  document.getElementById('mobileNav')?.classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', function() {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
});

/* ==========================================
   HEADER — dark/light on scroll
   ========================================== */

(function() {
  const header = document.getElementById('header');
  if (!header) return;

  if (!document.getElementById('hero')) {
    header.classList.remove('dark');
    return;
  }

  function updateHeader() {
    const hero = document.getElementById('hero');
    if (!hero) return;
    header.classList.toggle('dark', hero.getBoundingClientRect().bottom > 64);
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
})();

/* ==========================================
   SMOOTH SCROLL
   ========================================== */

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
});

/* ==========================================
   NOTICE HELPERS
   ========================================== */

function showNotice(el, type, text) {
  if (!el) return;
  el.className = 'notice show ' + type;
  el.textContent = text;
}

function hideNotice(el) {
  if (!el) return;
  el.className = 'notice';
  el.textContent = '';
}

/* ==========================================
   ACCOUNT PAGE
   ========================================== */

document.addEventListener('DOMContentLoaded', initAccount);

const EMAIL_KEY = 'troymbaEmail';

function getSavedEmail() { return localStorage.getItem(EMAIL_KEY) || ''; }
function saveEmail(e)    { localStorage.setItem(EMAIL_KEY, e); }
function clearEmail()    { localStorage.removeItem(EMAIL_KEY); }

async function fetchAccount(email) {
  const r = await fetch('/api/account?email=' + encodeURIComponent(email));
  if (!r.ok) throw new Error('server error');
  return r.json();
}

/* ---- Render transaction list ---- */
function renderTransactions(orders, withdrawals) {
  const container = document.getElementById('txList');
  if (!container) return;

  const rows = [];

  // Paid orders
  for (const o of (orders || [])) {
    if (o.status !== 'paid') continue;
    const date = fmtDate(o.paid_at || o.created_at);

    rows.push({
      date,
      title:       o.plan_name,
      amount:      '−' + fmt(o.amount),
      statusText:  'Оплачено',
      statusClass: 'done',
      isWinner:    o.is_winner === 1,
    });

    // Cashback row for winners
    if (o.is_winner === 1) {
      rows.push({
        date,
        title:       '🏆 Кэшбэк победителя',
        amount:      '+' + fmt(o.win_amount),
        statusText:  'Зачислено',
        statusClass: 'done',
        isCashback:  true,
      });
    }
  }

  // Withdrawal rows
  for (const w of (withdrawals || [])) {
    rows.push({
      date:        fmtDate(w.created_at),
      title:       'Вывод средств',
      amount:      '−' + fmt(w.amount),
      statusText:  w.status === 'done' ? 'Выполнено' : 'В обработке',
      statusClass: w.status === 'done' ? 'done' : 'pending',
    });
  }

  if (rows.length === 0) {
    container.innerHTML = '<div class="tx-empty"><i class="fas fa-inbox"></i>Пока нет операций</div>';
    return;
  }

  const txCount = document.getElementById('txCount');
  if (txCount) { txCount.textContent = rows.length; txCount.style.display = ''; }

  container.innerHTML = rows.map(r => `
    <div class="tx-row${r.isCashback ? ' tx-row-cashback' : ''}">
      <span class="tx-date">${r.date}</span>
      <span class="tx-title">
        ${r.title}
        ${r.isWinner ? '<span class="win-badge">Победитель</span>' : ''}
      </span>
      <span class="tx-amount ${r.amount.startsWith('+') ? 'plus' : 'minus'}">${r.amount}</span>
      <span><span class="tx-status ${r.statusClass}">${r.statusText}</span></span>
    </div>
  `).join('');
}

/* ---- Render plan progress ---- */
function renderPlanProgress(progress) {
  const container = document.getElementById('planProgressList');
  if (!container || !progress) return;

  const WIN_EVERY = 3;

  const html = Object.entries(progress).map(([, p]) => {
    const slot       = p.slot;          // 0,1,2 in current cycle
    const nextWinIn  = WIN_EVERY - slot; // purchases until next win

    // 3 dots: first two are regular buyers, third is the winner slot
    const dots = [1, 2, 3].map(i => {
      let cls = 'pdot';
      if (i <= slot)     cls += ' pdot-filled';
      if (i === WIN_EVERY) cls += ' pdot-win';
      if (i === slot + 1) cls += ' pdot-next';
      return `<div class="${cls}"></div>`;
    }).join('');

    const isNextWinner = slot === WIN_EVERY - 1;
    const hint = isNextWinner
      ? `<span class="pdot-hint-win">Следующий покупатель выигрывает!</span>`
      : `Место ${slot + 1} из ${WIN_EVERY} &mdash; через ${nextWinIn}\u00a0${pluralize(nextWinIn, 'покупку', 'покупки', 'покупок')} выигрыш`;

    return `
      <div class="plan-progress-item">
        <div class="plan-progress-top">
          <span class="plan-progress-name">${p.name}</span>
          <span class="plan-progress-prize">+${fmt(p.amount)}</span>
        </div>
        <div class="plan-progress-track">${dots}</div>
        <div class="plan-progress-hint">${hint}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

/* ---- Show / hide views ---- */
function showDashboard(email, data) {
  document.getElementById('registerView').style.display  = 'none';
  document.getElementById('dashboardView').style.display = '';

  document.getElementById('heroEmail').textContent = email;

  const balance = data.balance || 0;
  document.getElementById('balanceValue').textContent = fmt(balance);

  const hint = document.getElementById('balanceHint');
  if (hint) hint.textContent = balance > 0 ? 'Доступно для вывода' : '';

  renderTransactions(data.orders, data.withdrawals);
  renderPlanProgress(data.plan_progress);
}

function showRegister() {
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('registerView').style.display  = '';
}

/* ---- Main init ---- */
async function initAccount() {
  const regView  = document.getElementById('registerView');
  const dashView = document.getElementById('dashboardView');
  if (!regView && !dashView) return;

  // Auto-login from saved email
  const savedEmail = getSavedEmail();
  if (savedEmail) {
    try {
      const data = await fetchAccount(savedEmail);
      showDashboard(savedEmail, data);
    } catch {
      clearEmail();
      showRegister();
    }
    return;
  }

  showRegister();

  // Login form
  document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email  = this.querySelector('[name="email"]').value.trim();
    const notice = document.getElementById('loginNotice');
    const btn    = this.querySelector('button[type="submit"]');

    btn.disabled = true;
    const origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></span>';

    try {
      const data = await fetchAccount(email);
      saveEmail(email);
      showDashboard(email, data);
    } catch {
      showNotice(notice, 'error', 'Ошибка сервера. Попробуйте позже.');
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', function() {
    clearEmail();
    showRegister();
  });

  // Open withdraw modal
  document.getElementById('withdrawOpenBtn')?.addEventListener('click', function() {
    const notice  = document.getElementById('withdrawNotice');
    const balance = parseFloat(
      (document.getElementById('balanceValue')?.textContent || '0').replace(/[^\d.]/g, '')
    ) || 0;
    hideNotice(notice);
    if (balance <= 0) showNotice(notice, 'error', 'Недостаточно средств для вывода.');
    openModal('withdrawModal');
  });

  // Withdraw form submit
  document.getElementById('withdrawForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email   = getSavedEmail();
    const amount  = Number(this.querySelector('[name="amount"]').value);
    const method  = this.querySelector('[name="method"]').value;
    const details = this.querySelector('[name="details"]').value.trim();
    const notice  = document.getElementById('withdrawNotice');
    const btn     = this.querySelector('button[type="submit"]');

    if (!Number.isFinite(amount) || amount <= 0) {
      showNotice(notice, 'error', 'Введите корректную сумму.'); return;
    }

    btn.disabled = true;
    const origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></span> Отправка...';

    try {
      const r = await fetch('/api/withdraw', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, amount, method, details }),
      });
      const data = await r.json();

      if (!r.ok) {
        showNotice(notice, 'error', data.error ?? 'Ошибка сервера.');
        btn.disabled = false;
        btn.innerHTML = origText;
        return;
      }

      // Refresh balance and history
      const fresh = await fetchAccount(email);
      document.getElementById('balanceValue').textContent = fmt(fresh.balance || 0);
      renderTransactions(fresh.orders, fresh.withdrawals);

      showNotice(notice, 'success', 'Заявка принята. Средства поступят в течение 1–3 рабочих дней.');
      this.reset();
      setTimeout(() => closeModal('withdrawModal'), 1500);
    } catch {
      showNotice(notice, 'error', 'Ошибка соединения с сервером.');
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  });
}

/* ---- Helpers ---- */
function fmt(n) {
  return Number(n).toLocaleString('ru-RU') + '\u00a0₽';
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + (str.includes('T') ? '' : 'Z')).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

function pluralize(n, one, few, many) {
  const mod10  = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
