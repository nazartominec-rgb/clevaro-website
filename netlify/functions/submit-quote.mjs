// CLEVARO – obsługa formularza "Bezpłatna wycena".
// Adres: /.netlify/functions/submit-quote (POST, JSON).
//
// Zgłoszenie jest wysyłane e-mailem przez API Resend (https://resend.com).
// Wymagane zmienne środowiskowe (Netlify → Site configuration → Environment variables):
//   RESEND_API_KEY    – klucz API z panelu Resend (sekret, nigdy w kodzie)
//   QUOTE_TO_EMAIL    – adres, na który mają trafiać zgłoszenia
// Opcjonalne:
//   QUOTE_FROM_EMAIL  – nadawca, np. "CLEVARO <formularz@twoja-domena.pl>"
//                       (domyślnie adres testowy Resend: onboarding@resend.dev,
//                       który może wysyłać tylko na e-mail właściciela konta Resend)
//   ALLOWED_ORIGINS   – lista adresów strony oddzielona przecinkami,
//                       np. "https://clevaro.netlify.app"; puste = bez sprawdzania

const MIN_FILL_MS = 3000;          // szybsze wypełnienie formularza traktujemy jak bota
const MAX_BODY_BYTES = 10000;
const RATE_LIMIT = 5;              // maks. zgłoszeń z jednego IP…
const RATE_WINDOW_MS = 10 * 60e3;  // …w ciągu 10 minut (w obrębie jednej instancji funkcji)

const TYPES = ['Biuro', 'Siłownia', 'Magazyn', 'Sklep', 'Lokal usługowy', 'Inny obiekt komercyjny', 'Mycie okien'];
const FREQS = ['', 'Jednorazowo', 'Codziennie', 'Kilka razy w tygodniu', 'Raz w tygodniu', 'Raz w miesiącu'];
const CONTACTS = ['telefon', 'email'];

const hits = new Map();

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_LIMIT;
}

// Te same reguły co w script.js
function validate(d) {
  if (d.imie.length < 2) return 'Podaj imię (min. 2 znaki).';
  if (d.firma.length < 2) return 'Podaj nazwę firmy.';
  if (!/^\+?[0-9 ()-]{9,17}$/.test(d.telefon)) return 'Podaj poprawny numer telefonu.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return 'Podaj poprawny adres e-mail.';
  if (!TYPES.includes(d.rodzaj)) return 'Wybierz rodzaj obiektu.';
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(d.powierzchnia) || !(parseFloat(d.powierzchnia.replace(',', '.')) > 0)) return 'Podaj powierzchnię w m².';
  if (!FREQS.includes(d.czestotliwosc)) return 'Wybierz częstotliwość sprzątania z listy.';
  if (!CONTACTS.includes(d.kontakt)) return 'Wybierz preferowany sposób kontaktu.';
  return null;
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function handler(req, context) {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Metoda niedozwolona.' });

  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin');
  if (allowed.length && origin && !allowed.includes(origin)) return json(403, { ok: false, error: 'Niedozwolone źródło zapytania.' });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(400, { ok: false, error: 'Zgłoszenie jest zbyt długie.' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'Nieprawidłowe dane formularza.' }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'Nieprawidłowe dane formularza.' });

  // Ochrona przed botami: ukryte pole wypełnione lub formularz wysłany zbyt szybko.
  // Odpowiadamy "ok", aby bot nie dowiedział się, że został odrzucony.
  const elapsed = Number(body._e);
  if (str(body.website, 200) !== '' || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return json(200, { ok: true });

  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (rateLimited(ip)) return json(429, { ok: false, error: 'Zbyt wiele prób.' });

  const d = {
    imie: str(body.imie, 80),
    firma: str(body.firma, 120),
    telefon: str(body.telefon, 25),
    email: str(body.email, 120),
    rodzaj: str(body.rodzaj, 60),
    powierzchnia: str(body.powierzchnia, 12),
    czestotliwosc: str(body.czestotliwosc, 60),
    kontakt: str(body.kontakt, 20),
    wiadomosc: str(body.wiadomosc, 1000)
  };
  const err = validate(d);
  if (err) return json(400, { ok: false, error: err });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.QUOTE_TO_EMAIL;
  if (!apiKey || !to) {
    console.error('submit-quote: brak RESEND_API_KEY lub QUOTE_TO_EMAIL');
    return json(500, { ok: false, error: 'Formularz jest chwilowo niedostępny.' });
  }
  const from = process.env.QUOTE_FROM_EMAIL || 'CLEVARO <onboarding@resend.dev>';

  const rows = [
    ['Imię', d.imie],
    ['Firma', d.firma],
    ['Telefon', d.telefon],
    ['E-mail', d.email],
    ['Rodzaj obiektu', d.rodzaj],
    ['Powierzchnia (m²)', d.powierzchnia],
    ['Częstotliwość', d.czestotliwosc || 'Do ustalenia'],
    ['Preferowany kontakt', d.kontakt === 'email' ? 'E-mail' : 'Telefon'],
    ['Wiadomość', d.wiadomosc || '—']
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = '<h2>Nowe zapytanie o wycenę – CLEVARO</h2><table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(([k, v]) => `<tr><th align="left" valign="top">${esc(k)}</th><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join('') +
    '</table>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: d.email,
        subject: `Zapytanie o wycenę: ${d.rodzaj}, ${d.powierzchnia} m² – ${d.firma}`.replace(/[\r\n]+/g, ' '),
        text,
        html
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) {
      console.error('submit-quote: Resend', r.status, (await r.text()).slice(0, 500));
      return json(502, { ok: false, error: 'Nie udało się wysłać zapytania.' });
    }
  } catch (e) {
    console.error('submit-quote: błąd wysyłki', e && e.message);
    return json(502, { ok: false, error: 'Nie udało się wysłać zapytania.' });
  }

  return json(200, { ok: true });
}
