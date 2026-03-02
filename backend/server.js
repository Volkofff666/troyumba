'use strict';

const express  = require('express');
const crypto   = require('crypto');
const path     = require('path');
const Database = require('better-sqlite3');

/* ==========================================
   CONFIG
   ========================================== */
const {
  FK_SHOP_ID,
  FK_API_KEY,
  FK_SECRET_WORD_2,
  // ID платёжных систем для выплат (найти в admin.freekassa.ru → Выплаты → Доступные методы)
  FK_PAYOUT_CARD_PS_ID = '4',   // банковская карта
  FK_PAYOUT_SBP_PS_ID  = '44',  // СБП (по номеру телефона)
  SITE_URL = 'https://troyumba.ru',
  PORT = 3000,
} = process.env;

if (!FK_SHOP_ID || !FK_API_KEY || !FK_SECRET_WORD_2) {
  console.error('[ERROR] Не заданы переменные окружения FK_SHOP_ID / FK_API_KEY / FK_SECRET_WORD_2');
  process.exit(1);
}

const FK_API_URL = 'https://api.fk.life/v1/';

/* ==========================================
   PLANS + WIN MECHANIC CONSTANT
   ========================================== */
const PLANS = {
  starter:      { name: 'Стартовый',        amount: 200,  currency: 'RUB' },
  professional: { name: 'Профессиональный', amount: 500,  currency: 'RUB' },
  business:     { name: 'Бизнес',           amount: 1000, currency: 'RUB' },
};

// Каждый WIN_EVERY-й покупатель тарифа получает кэшбэк WIN_MULTIPLIER * стоимость тарифа
const WIN_EVERY      = 3;
const WIN_MULTIPLIER = 2; // победитель получает x2 от цены покупки

/* ==========================================
   DATABASE
   ========================================== */
const DB_PATH = path.join(__dirname, 'data', 'db.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    fk_order_id INTEGER,
    plan_key    TEXT NOT NULL,
    plan_name   TEXT NOT NULL,
    amount      REAL NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'RUB',
    email       TEXT NOT NULL,
    ip          TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    is_winner   INTEGER NOT NULL DEFAULT 0,
    win_amount  REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS wallets (
    email      TEXT PRIMARY KEY,
    balance    REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    amount     REAL NOT NULL,
    method     TEXT NOT NULL,
    details    TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Миграции: добавляем колонки если DB уже существовала без них
try { db.exec(`ALTER TABLE orders ADD COLUMN is_winner INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE orders ADD COLUMN win_amount REAL NOT NULL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE withdrawals ADD COLUMN fk_withdrawal_id TEXT`); } catch {}

/* Подготовленные выражения */
const stmtInsert = db.prepare(`
  INSERT INTO orders (id, plan_key, plan_name, amount, currency, email, ip)
  VALUES (@id, @planKey, @planName, @amount, @currency, @email, @ip)
`);

const stmtSetFKId = db.prepare(`
  UPDATE orders SET fk_order_id = @fkOrderId WHERE id = @id
`);

const stmtMarkPaid = db.prepare(`
  UPDATE orders SET status = 'paid', paid_at = datetime('now')
  WHERE id = @id AND status != 'paid'
`);

const stmtFindById = db.prepare(`SELECT * FROM orders WHERE id = ?`);

const stmtCountPaidByPlan = db.prepare(`
  SELECT COUNT(*) as count FROM orders WHERE plan_key = ? AND status = 'paid'
`);

/* ==========================================
   HELPERS
   ========================================== */
function generateOrderId() {
  return 'TRM_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function fkApiSignature(params) {
  const values = Object.keys(params).sort().map(k => params[k]).join('|');
  return crypto.createHmac('sha256', FK_API_KEY).update(values).digest('hex');
}

function verifyNotifySign(merchantId, amount, orderId, sign) {
  const expected = crypto.createHash('md5')
    .update(`${merchantId}:${amount}:${FK_SECRET_WORD_2}:${orderId}`)
    .digest('hex');
  return expected === sign;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

/* ==========================================
   EXPRESS
   ========================================== */
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'Troymba');
  next();
});

/* ==========================================
   ROUTES
   ========================================== */

/** Health check */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/**
 * POST /api/create-order
 * Body: { planKey, email }
 */
app.post('/api/create-order', async (req, res) => {
  const { planKey, email } = req.body ?? {};

  const plan = PLANS[planKey];
  if (!plan) return res.status(400).json({ error: 'Неверный тариф' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Неверный email' });
  }

  const paymentId = generateOrderId();
  const nonce     = String(Date.now());
  const ip        = getClientIp(req);

  const signParams = {
    shopId: FK_SHOP_ID, nonce, paymentId,
    i: String(plan.amount), email, ip,
    amount: String(plan.amount), currency: plan.currency,
  };

  const signature = fkApiSignature(signParams);

  const fkBody = {
    shopId: FK_SHOP_ID, nonce, paymentId, email, ip,
    amount: String(plan.amount),
    currency: plan.currency,
    successUrl:      `${SITE_URL}/success.html`,
    failUrl:         `${SITE_URL}/fail.html`,
    notificationUrl: `${SITE_URL}/api/payment/notify`,
    signature,
  };

  stmtInsert.run({
    id: paymentId, planKey, planName: plan.name,
    amount: plan.amount, currency: plan.currency, email, ip,
  });

  let fkRes;
  try {
    const response = await fetch(`${FK_API_URL}orders/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FK_API_KEY}` },
      body:    JSON.stringify(fkBody),
    });
    fkRes = await response.json();
  } catch (err) {
    console.error('[FreeKassa] Сетевая ошибка:', err.message);
    return res.status(502).json({ error: 'Ошибка соединения с платёжной системой.' });
  }

  if (fkRes.type !== 'success') {
    console.error('[FreeKassa] Ошибка создания заказа:', fkRes);
    return res.status(400).json({ error: fkRes.message ?? 'Платёжная система вернула ошибку.' });
  }

  stmtSetFKId.run({ fkOrderId: fkRes.orderId, id: paymentId });
  console.log(`[ORDER] Создан заказ ${paymentId} (FK #${fkRes.orderId}) на ${plan.amount} ₽ для ${email}`);
  res.json({ url: fkRes.location });
});

/**
 * GET /api/payment/notify
 * FreeKassa проверяет доступность URL через GET перед активацией магазина
 */
app.get('/api/payment/notify', (req, res) => res.send('YES'));

/**
 * POST /api/payment/notify
 * FreeKassa webhook — запускает механику выигрыша
 */
app.post('/api/payment/notify', (req, res) => {
  const { MERCHANT_ID, AMOUNT, MERCHANT_ORDER_ID, P_EMAIL, intid, SIGN } = req.body ?? {};

  if (!MERCHANT_ID || !AMOUNT || !MERCHANT_ORDER_ID || !SIGN) {
    console.warn('[NOTIFY] Неполные параметры:', req.body);
    return res.status(400).send('BAD REQUEST');
  }

  if (!verifyNotifySign(MERCHANT_ID, AMOUNT, MERCHANT_ORDER_ID, SIGN)) {
    console.warn(`[NOTIFY] Неверная подпись для заказа ${MERCHANT_ORDER_ID}`);
    return res.status(400).send('BAD SIGN');
  }

  const order = stmtFindById.get(MERCHANT_ORDER_ID);
  if (!order) {
    console.warn(`[NOTIFY] Заказ не найден: ${MERCHANT_ORDER_ID}`);
    return res.status(404).send('NOT FOUND');
  }

  // Всё в одной транзакции: оплата + проверка выигрыша
  const processPayment = db.transaction(() => {
    const changes = stmtMarkPaid.run({ id: MERCHANT_ORDER_ID });
    if (changes.changes === 0) return { alreadyPaid: true };

    // Сколько оплаченных заказов этого тарифа теперь (включая текущий)?
    const { count } = stmtCountPaidByPlan.get(order.plan_key);

    let isWinner = false;
    if (count % WIN_EVERY === 0) {
      isWinner = true;
      const winAmount = order.amount * WIN_MULTIPLIER; // x2 от стоимости покупки

      db.prepare(`UPDATE orders SET is_winner = 1, win_amount = ? WHERE id = ?`)
        .run(winAmount, MERCHANT_ORDER_ID);

      // Начислить на кошелёк (upsert)
      db.prepare(`
        INSERT INTO wallets (email, balance) VALUES (?, ?)
        ON CONFLICT(email) DO UPDATE SET
          balance    = balance + excluded.balance,
          updated_at = datetime('now')
      `).run(order.email, winAmount);
    }

    return { alreadyPaid: false, isWinner, count };
  });

  const result = processPayment();

  if (result.alreadyPaid) {
    console.log(`[NOTIFY] Заказ ${MERCHANT_ORDER_ID} уже оплачен (дубль).`);
  } else {
    console.log(`[PAID] Заказ ${MERCHANT_ORDER_ID} оплачен. Email: ${P_EMAIL ?? order.email}, Сумма: ${AMOUNT} ₽, FK TX: ${intid}. Покупка #${result.count} тарифа «${order.plan_key}»`);
    if (result.isWinner) {
      console.log(`[WIN] Победитель! ${order.email} получает ${order.amount * WIN_MULTIPLIER} ₽ (x${WIN_MULTIPLIER} от ${order.amount} ₽, покупка #${result.count})`);
    }
  }

  res.send('YES');
});

/**
 * GET /api/account?email=...
 * Возвращает данные для личного кабинета:
 *   balance, orders, withdrawals, plan_progress (глобальный счётчик)
 */
app.get('/api/account', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Неверный email' });
  }

  const orders = db.prepare(`
    SELECT id, plan_key, plan_name, amount, currency, status,
           is_winner, win_amount, created_at, paid_at
    FROM orders
    WHERE LOWER(email) = ?
    ORDER BY created_at DESC
  `).all(email);

  const wallet  = db.prepare(`SELECT balance FROM wallets WHERE LOWER(email) = ?`).get(email);
  const balance = wallet ? wallet.balance : 0;

  const withdrawals = db.prepare(`
    SELECT id, amount, method, details, status, created_at
    FROM withdrawals
    WHERE LOWER(email) = ?
    ORDER BY created_at DESC
  `).all(email);

  // Глобальный прогресс по каждому тарифу
  const plan_progress = {};
  for (const [key, plan] of Object.entries(PLANS)) {
    const { count } = stmtCountPaidByPlan.get(key);
    plan_progress[key] = {
      name:       plan.name,
      price:      plan.amount,                      // цена тарифа
      win_amount: plan.amount * WIN_MULTIPLIER,     // приз победителя (x2)
      total_paid: count,
      slot:       count % WIN_EVERY,
    };
  }

  res.json({ balance, orders, withdrawals, plan_progress });
});

/**
 * POST /api/withdraw
 * Body: { email, amount, method, details }
 * method: 'card' | 'sbp'
 * details: номер карты (card) или номер телефона (sbp)
 */
app.post('/api/withdraw', async (req, res) => {
  const { email, amount, method, details } = req.body ?? {};

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Неверный email' });
  }

  const numAmount = parseFloat(amount);
  if (!Number.isFinite(numAmount) || numAmount < 1) {
    return res.status(400).json({ error: 'Неверная сумма' });
  }

  if (!method || !['card', 'sbp'].includes(method)) {
    return res.status(400).json({ error: 'Неверный способ вывода' });
  }

  const cleanDetails = String(details || '').trim();
  if (cleanDetails.length < 3) {
    return res.status(400).json({ error: 'Укажите реквизиты' });
  }

  // 1. Атомарно: проверить баланс, списать, создать запись pending
  const wdId = 'WD_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const prepareWithdraw = db.transaction(() => {
    const wallet  = db.prepare(`SELECT balance FROM wallets WHERE LOWER(email) = ?`).get(cleanEmail);
    const balance = wallet ? wallet.balance : 0;

    if (numAmount > balance) return { error: 'Недостаточно средств' };

    db.prepare(`
      UPDATE wallets SET balance = balance - ?, updated_at = datetime('now')
      WHERE LOWER(email) = ?
    `).run(numAmount, cleanEmail);

    db.prepare(`
      INSERT INTO withdrawals (id, email, amount, method, details, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(wdId, cleanEmail, numAmount, method, cleanDetails);

    return { ok: true };
  });

  const prepared = prepareWithdraw();
  if (prepared.error) return res.status(400).json({ error: prepared.error });

  // 2. Вызов FreeKassa Payout API
  const psId  = method === 'sbp' ? FK_PAYOUT_SBP_PS_ID : FK_PAYOUT_CARD_PS_ID;
  const nonce = String(Date.now());

  const signParams = {
    account:         cleanDetails,
    amount:          String(numAmount),
    currency:        'RUB',
    nonce,
    paymentId:       wdId,
    paymentSystemId: psId,
    shopId:          FK_SHOP_ID,
  };
  const signature = fkApiSignature(signParams);

  let fkRes;
  try {
    const response = await fetch(`${FK_API_URL}withdrawals/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FK_API_KEY}` },
      body:    JSON.stringify({ ...signParams, signature }),
    });
    fkRes = await response.json();
  } catch (err) {
    console.error('[PAYOUT] Сетевая ошибка:', err.message);
    // Восстановить баланс и пометить failed
    db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE LOWER(email) = ?`)
      .run(numAmount, cleanEmail);
    db.prepare(`UPDATE withdrawals SET status = 'failed' WHERE id = ?`).run(wdId);
    return res.status(502).json({ error: 'Ошибка соединения с платёжной системой.' });
  }

  if (fkRes.type !== 'success') {
    console.error('[PAYOUT] Ошибка FreeKassa:', fkRes);
    // Восстановить баланс и пометить failed
    db.prepare(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE LOWER(email) = ?`)
      .run(numAmount, cleanEmail);
    db.prepare(`UPDATE withdrawals SET status = 'failed' WHERE id = ?`).run(wdId);
    return res.status(400).json({ error: fkRes.message ?? 'Ошибка выплаты. Попробуйте позже.' });
  }

  // 3. Успех — FK принял выплату в обработку
  db.prepare(`UPDATE withdrawals SET status = 'processing', fk_withdrawal_id = ? WHERE id = ?`)
    .run(String(fkRes.id ?? ''), wdId);

  console.log(`[PAYOUT] ${cleanEmail} — вывод ${numAmount} ₽ (${method}) принят FK. FK ID: ${fkRes.id}, WD: ${wdId}`);
  res.json({ ok: true, id: wdId });
});

/* ==========================================
   START
   ========================================== */
app.listen(PORT, () => {
  console.log(`[SERVER] Troymba backend запущен на порту ${PORT}`);
  console.log(`[SERVER] Shop ID: ${FK_SHOP_ID}`);
  console.log(`[SERVER] Site URL: ${SITE_URL}`);
  console.log(`[SERVER] DB: ${DB_PATH}`);
  console.log(`[SERVER] Механика выигрыша: каждый ${WIN_EVERY}-й покупатель получает кэшбэк`);
});
