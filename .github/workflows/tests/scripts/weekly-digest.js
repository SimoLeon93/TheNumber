// scripts/weekly-digest.js
// Interroga Stripe + Firebase e manda un digest su Telegram ogni lunedì
// Richiede: STRIPE_SECRET_KEY, FIREBASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const https = require('https');

// ─── Helpers ──────────────────────────────────
function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
  });
}

function sendTelegram(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Stripe: ultimi 7 giorni di charge ────────
async function getStripeStats() {
  const token = process.env.STRIPE_SECRET_KEY;
  if (!token) return null;

  const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const url = `https://api.stripe.com/v1/payment_intents?limit=100&created[gte]=${since}`;

  const res = await httpsGet(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.body?.data) return null;

  const payments = res.body.data.filter(p => p.status === 'succeeded');
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0) / 100;
  const byAmount = {};
  
  payments.forEach(p => {
    const eur = (p.amount / 100).toFixed(0);
    byAmount[eur] = (byAmount[eur] || 0) + 1;
  });

  return {
    totalPayments: payments.length,
    totalRevenue: totalRevenue.toFixed(2),
    byTier: byAmount
  };
}

// ─── Firebase: counter totale ─────────────────
async function getFirebaseCounter() {
  const fbUrl = process.env.FIREBASE_URL;
  if (!fbUrl) return null;

  try {
    const res = await httpsGet(`${fbUrl}/counter.json`);
    return typeof res.body === 'number' ? res.body : res.body?.value ?? null;
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    process.exit(1);
  }

  const [stripe, counter] = await Promise.all([getStripeStats(), getFirebaseCounter()]);

  const now = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  let msg = `📊 <b>TheNumber — Weekly Digest</b>\n<i>${now}</i>\n\n`;

  // Counter
  if (counter !== null) {
    msg += `👁️ <b>Watchers totali:</b> ${counter.toLocaleString()}\n`;
  } else {
    msg += `👁️ <b>Watchers:</b> N/D (Firebase non configurato)\n`;
  }

  msg += '\n';

  // Stripe
  if (stripe) {
    msg += `💳 <b>Ultimi 7 giorni:</b>\n`;
    msg += `  • Pagamenti: <b>${stripe.totalPayments}</b>\n`;
    msg += `  • Revenue: <b>€${stripe.totalRevenue}</b>\n`;

    if (Object.keys(stripe.byTier).length > 0) {
      msg += `\n<b>Breakdown per tier:</b>\n`;
      const tierNames = { '1': '€1 — Curiosity', '3': '€3 — Believer', '5': '€5 — Obsessed' };
      Object.entries(stripe.byTier)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .forEach(([amount, count]) => {
          const name = tierNames[amount] || `€${amount}`;
          const pct = stripe.totalPayments > 0 
            ? Math.round((count / stripe.totalPayments) * 100) 
            : 0;
          msg += `  • ${name}: ${count} (${pct}%)\n`;
        });
    }

    // Monetization opportunity flag
    if (stripe.totalPayments > 0) {
      const topTier = Object.entries(stripe.byTier).sort((a, b) => b[1] - a[1])[0];
      if (topTier) {
        const topName = { '1': '€1', '3': '€3', '5': '€5' }[topTier[0]] || `€${topTier[0]}`;
        msg += `\n💡 <b>Opportunità:</b> Il tier ${topName} converte di più — valuta A/B test sul copy di quel tier.`;
      }
    } else {
      msg += `\n⚠️ Nessun pagamento questa settimana — considera una spinta su social/community.`;
    }

  } else {
    msg += `💳 <b>Stripe:</b> N/D (chiave non configurata)\n`;
  }

  msg += `\n\n🌐 <a href="https://simoleon93.github.io/TheNumber">Apri TheNumber</a>`;

  await sendTelegram(token, chatId, msg);
  console.log('Digest inviato con successo.');
}

main().catch(err => {
  console.error('Digest error:', err);
  process.exit(1);
});