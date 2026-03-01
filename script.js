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

function initAccount() {
  const regView  = document.getElementById('registerView');
  const dashView = document.getElementById('dashboardView');
  if (!regView && !dashView) return;

  const regForm        = document.getElementById('regForm');
  const logoutBtn      = document.getElementById('logoutBtn');
  const withdrawOpen   = document.getElementById('withdrawOpenBtn');
  const withdrawForm   = document.getElementById('withdrawForm');
  const withdrawNotice = document.getElementById('withdrawNotice');

  function loadUser()   { try { return JSON.parse(localStorage.getItem('troymbaUser'));   } catch { return null; } }
  function loadWallet() { try { return JSON.parse(localStorage.getItem('troymbaWallet')); } catch { return null; } }

  let user   = loadUser();
  let wallet = loadWallet() || { balance: 0, currency: '₽', transactions: [] };

  function renderTransactions(txList) {
    const container = document.getElementById('txList');
    if (!container) return;
    container.innerHTML = '';

    if (!txList || txList.length === 0) {
      container.innerHTML = '<div class="tx-empty"><i class="fas fa-inbox"></i>Пока нет операций</div>';
      return;
    }

    txList.forEach(tx => {
      const isNeg = tx.amount.trim().startsWith('-');
      const row   = document.createElement('div');
      row.className = 'tx-row';
      row.innerHTML = `
        <span class="tx-date">${tx.date}</span>
        <span class="tx-title">${tx.title}</span>
        <span class="tx-amount ${isNeg ? 'minus' : 'plus'}">${tx.amount}</span>
        <span><span class="tx-status ${tx.status === 'Завершено' ? 'done' : 'pending'}">${tx.status}</span></span>
      `;
      container.appendChild(row);
    });
  }

  function showDashboard(u) {
    if (regView)  regView.style.display  = 'none';
    if (dashView) dashView.style.display = '';
    document.getElementById('heroGreeting').textContent = 'Привет, ' + u.name + '!';
    document.getElementById('heroEmail').textContent    = u.email;
    document.getElementById('profileName').textContent  = u.name;
    document.getElementById('profileEmail').textContent = u.email;
    document.getElementById('balanceValue').textContent = wallet.balance + ' ' + wallet.currency;
    renderTransactions(wallet.transactions);
  }

  function showRegister() {
    if (dashView) dashView.style.display = 'none';
    if (regView)  regView.style.display  = '';
  }

  if (user) showDashboard(user);
  else      showRegister();

  if (regForm) {
    regForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const name     = regForm.querySelector('[name="name"]').value.trim();
      const email    = regForm.querySelector('[name="email"]').value.trim();
      const password = regForm.querySelector('[name="password"]').value.trim();
      const notice   = document.getElementById('regNotice');

      if (password.length < 6) { showNotice(notice, 'error', 'Пароль должен быть минимум 6 символов.'); return; }

      user = { name, email };
      localStorage.setItem('troymbaUser', JSON.stringify(user));
      wallet = { balance: 0, currency: '₽', transactions: [] };
      localStorage.setItem('troymbaWallet', JSON.stringify(wallet));
      showDashboard(user);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('troymbaUser');
      user = null;
      showRegister();
    });
  }

  if (withdrawOpen) {
    withdrawOpen.addEventListener('click', function() {
      hideNotice(withdrawNotice);
      if (wallet.balance <= 0) {
        showNotice(withdrawNotice, 'error', 'Недостаточно средств для вывода.');
      }
      openModal('withdrawModal');
    });
  }

  if (withdrawForm) {
    withdrawForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const amount = Number(withdrawForm.querySelector('[name="amount"]').value);

      if (!Number.isFinite(amount) || amount <= 0) {
        showNotice(withdrawNotice, 'error', 'Введите корректную сумму.'); return;
      }
      if (amount > wallet.balance) {
        showNotice(withdrawNotice, 'error', 'Сумма превышает доступный баланс.'); return;
      }

      wallet.balance -= amount;
      wallet.transactions.unshift({
        date:   new Date().toLocaleDateString('ru-RU'),
        title:  'Заявка на вывод',
        amount: '-' + amount + ' ' + wallet.currency,
        status: 'В обработке',
      });
      localStorage.setItem('troymbaWallet', JSON.stringify(wallet));
      document.getElementById('balanceValue').textContent = wallet.balance + ' ' + wallet.currency;
      renderTransactions(wallet.transactions);
      showNotice(withdrawNotice, 'success', 'Заявка принята. Средства поступят в течение 1–3 рабочих дней.');
      withdrawForm.reset();
      setTimeout(() => closeModal('withdrawModal'), 1200);
    });
  }
}
