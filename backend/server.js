'use strict';

const express  = require('express');
const crypto   = require('crypto');
const path     = require('path');
const Database = require('better-sqlite3');

/* ==========================================
   CONFIG (from environment variables)
   ========================================== */
const {
  FK_SHOP_ID,        // ID магазина в FreeKassa
  FK_API_KEY,        // API ключ (из настроек → API ключи)
  FK_SECRET_WORD_2,  // Секретное слово 2 (для верификации webhook)
  SITE_URL = 'https://troyumba.ru',
  PORT = 3000,
} = process.env;

if (!FK_SHOP_ID || !FK_API_KEY || !FK_SECRET_WORD_2) {
  console.error('[ERROR] Не заданы переменные окружения FK_SHOP_ID / FK_API_KEY / FK_SECRET_WORD_2');
  process.exit(1);
}

const FK_API_URL = 'https://api.fk.life/v1/';

/* ==========================================
   PLANS CATALOG
   ========================================== */
const PLANS = {
  starter:      { name: 'Стартовый',        amount: 200,  currency: 'RUB' },
  professional: { name: 'Профессиональный', amount: 500,  currency: 'RUB' },
  business:     { name: 'Бизнес',           amount: 1000, currency: 'RUB' },
};

/* ==========================================
   DATABASE (SQLite)
   ========================================== */
const DB_PATH = path.join(__dirname, 'data', 'db.sqlite');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    fk_order_id INTEGER,
    plan_key    TEXT    NOT NULL,
    plan_name   TEXT    NOT NULL,
    amount      REAL    NOT NULL,
    currency    TEXT    NOT NULL DEFAULT 'RUB',
    email       TEXT    NOT NULL,
    ip          TEXT,
    status      TEXT    NOT NULL DEFAULT 'pending',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    paid_at     TEXT
  )
`);

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

/* ==========================================
   HELPERS
   ========================================== */

/** Генерирует уникальный ID заказа */
function generateOrderId() {
  return 'TRM_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Подпись для FreeKassa createOrder API:
 * HMAC-SHA256 значений параметров, отсортированных по ключу, joined '|'
 */
function fkApiSignature(params) {
  const values = Object.keys(params)
    .sort()
    .map(k => params[k])
    .join('|');
  return crypto.createHmac('sha256', FK_API_KEY).update(values).digest('hex');
}

/**
 * Верификация webhook-подписи от FreeKassa:
 * MD5(MERCHANT_ID:AMOUNT:SECRET_WORD_2:MERCHANT_ORDER_ID)
 */
function verifyNotifySign(merchantId, amount, orderId, sign) {
  const expected = crypto.createHash('md5')
    .update(`${merchantId}:${amount}:${FK_SECRET_WORD_2}:${orderId}`)
    .digest('hex');
  return expected === sign;
}

/** Получить IP клиента (учитывает Caddy X-Forwarded-For) */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

/* ==========================================
   EXPRESS APP
   ========================================== */
const app = express();

app.set('trust proxy', 1); // доверяем Caddy

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // для webhook от FreeKassa

/* ---- CORS для dev (в продакшне Caddy обрабатывает всё на одном домене) ---- */
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
 * Body: { planKey: string, email: string }
 * Returns: { url: string } — ссылка на оплату FreeKassa
 */
app.post('/api/create-order', async (req, res) => {
  const { planKey, email } = req.body ?? {};

  // Валидация
  const plan = PLANS[planKey];
  if (!plan) {
    return res.status(400).json({ error: 'Неверный тариф' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Неверный email' });
  }

  const paymentId = generateOrderId();
  const nonce     = String(Date.now());
  const ip        = getClientIp(req);

  // Параметры, которые входят в подпись
  const signParams = {
    shopId:    FK_SHOP_ID,
    nonce,
    paymentId,
    i:         String(plan.amount), // amount как строка
    email,
    ip,
    amount:    String(plan.amount),
    currency:  plan.currency,
  };

  const signature = fkApiSignature(signParams);

  // Тело запроса к FreeKassa (подпись уже вычислена)
  const fkBody = {
    shopId:          FK_SHOP_ID,
    nonce,
    paymentId,
    email,
    ip,
    amount:          String(plan.amount),
    currency:        plan.currency,
    successUrl:      `${SITE_URL}/success.html`,
    failUrl:         `${SITE_URL}/fail.html`,
    notificationUrl: `${SITE_URL}/api/payment/notify`,
    signature,
  };

  // Сохраняем заказ в БД (статус pending)
  stmtInsert.run({
    id:       paymentId,
    planKey,
    planName: plan.name,
    amount:   plan.amount,
    currency: plan.currency,
    email,
    ip,
  });

  // Вызываем FreeKassa createOrder API
  let fkRes;
  try {
    const response = await fetch(`${FK_API_URL}orders/create`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${FK_API_KEY}`,
      },
      body: JSON.stringify(fkBody),
    });

    fkRes = await response.json();
  } catch (err) {
    console.error('[FreeKassa] Сетевая ошибка:', err.message);
    return res.status(502).json({ error: 'Ошибка соединения с платёжной системой. Попробуйте позже.' });
  }

  if (fkRes.type !== 'success') {
    console.error('[FreeKassa] Ошибка создания заказа:', fkRes);
    return res.status(400).json({ error: fkRes.message ?? 'Платёжная система вернула ошибку.' });
  }

  // Обновляем FK order ID в БД
  stmtSetFKId.run({ fkOrderId: fkRes.orderId, id: paymentId });

  console.log(`[ORDER] Создан заказ ${paymentId} (FK #${fkRes.orderId}) на ${plan.amount} ₽ для ${email}`);

  res.json({ url: fkRes.location });
});

/**
 * POST /api/payment/notify
 * FreeKassa webhook — вызывается после успешной оплаты
 * Параметры: MERCHANT_ID, AMOUNT, MERCHANT_ORDER_ID, P_EMAIL, intid, CUR_ID, SIGN
 */
app.post('/api/payment/notify', (req, res) => {
  const {
    MERCHANT_ID,
    AMOUNT,
    MERCHANT_ORDER_ID,
    P_EMAIL,
    intid,
    SIGN,
  } = req.body ?? {};

  // Проверяем, что все нужные поля пришли
  if (!MERCHANT_ID || !AMOUNT || !MERCHANT_ORDER_ID || !SIGN) {
    console.warn('[NOTIFY] Неполные параметры:', req.body);
    return res.status(400).send('BAD REQUEST');
  }

  // Верифицируем подпись
  if (!verifyNotifySign(MERCHANT_ID, AMOUNT, MERCHANT_ORDER_ID, SIGN)) {
    console.warn(`[NOTIFY] Неверная подпись для заказа ${MERCHANT_ORDER_ID}`);
    return res.status(400).send('BAD SIGN');
  }

  // Проверяем, что заказ существует
  const order = stmtFindById.get(MERCHANT_ORDER_ID);
  if (!order) {
    console.warn(`[NOTIFY] Заказ не найден: ${MERCHANT_ORDER_ID}`);
    return res.status(404).send('NOT FOUND');
  }

  // Помечаем как оплаченный
  const changes = stmtMarkPaid.run({ id: MERCHANT_ORDER_ID });

  if (changes.changes > 0) {
    console.log(`[PAID] Заказ ${MERCHANT_ORDER_ID} оплачен. Email: ${P_EMAIL}, Сумма: ${AMOUNT}, FK TX: ${intid}`);
    // TODO: здесь можно добавить генерацию и отправку API ключа на email
  } else {
    console.log(`[NOTIFY] Заказ ${MERCHANT_ORDER_ID} уже был помечен как оплаченный (дубль).`);
  }

  // FreeKassa ожидает ответ "YES" для подтверждения получения
  res.send('YES');
});

/* ==========================================
   START
   ========================================== */
app.listen(PORT, () => {
  console.log(`[SERVER] Troymba backend запущен на порту ${PORT}`);
  console.log(`[SERVER] Shop ID: ${FK_SHOP_ID}`);
  console.log(`[SERVER] Site URL: ${SITE_URL}`);
  console.log(`[SERVER] DB: ${DB_PATH}`);
});
