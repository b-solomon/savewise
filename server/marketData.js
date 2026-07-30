// Live Market Data — Yahoo Finance for NSE/BSE Indian + US stocks
// Caches prices for 60s to avoid rate limiting

const CACHE = new Map();
const CACHE_TTL = 60000; // 60 seconds

// Yahoo Finance symbol mapping
function toYahooSymbol(symbol, exchange) {
  const s = symbol.toUpperCase().replace(/\s/g, '');
  if (exchange === 'NSE') return `${s}.NS`;
  if (exchange === 'BSE') return `${s}.BO`;
  // US stocks (NYSE/NASDAQ) — use symbol as-is
  return s;
}

async function fetchYahoo(yahooSymbol) {
  const cached = CACHE.get(yahooSymbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!res.ok) throw new Error(`Yahoo API ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error('No data');

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];

    const currentPrice = meta.regularMarketPrice || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const dayChange = currentPrice - previousClose;
    const dayChangePct = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;
    const currency = meta.currency || 'INR';

    // Build 5-day mini sparkline data
    const sparkline = [];
    if (quotes?.close) {
      for (let i = 0; i < quotes.close.length; i++) {
        if (quotes.close[i] != null) sparkline.push(quotes.close[i]);
      }
    }

    const data = { symbol: meta.symbol, price: currentPrice, previousClose, dayChange: Math.round(dayChange * 100) / 100,
      dayChangePct: Math.round(dayChangePct * 100) / 100, currency, sparkline, name: meta.shortName || meta.symbol,
      exchange: meta.exchangeName || '' };

    CACHE.set(yahooSymbol, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error(`Market data error for ${yahooSymbol}:`, err.message);
    return { symbol: yahooSymbol, price: 0, dayChange: 0, dayChangePct: 0, error: err.message };
  }
}

/**
 * Get live prices for multiple holdings
 * Returns: array of { ...holding, livePrice, dayChange, dayChangePct, currentValue, pnl, pnlPct }
 */
export async function getLivePrices(holdings) {
  const results = [];

  // Batch fetch (sequential to avoid rate limits)
  for (const h of holdings) {
    const yahooSym = toYahooSymbol(h.symbol, h.exchange);
    const market = await fetchYahoo(yahooSym);

    const livePrice = market.price || h.avg_buy_price;
    const currentValue = livePrice * h.quantity;
    const investedValue = h.avg_buy_price * h.quantity;
    const pnl = currentValue - investedValue;
    const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    results.push({
      ...h,
      livePrice: Math.round(livePrice * 100) / 100,
      dayChange: market.dayChange || 0,
      dayChangePct: market.dayChangePct || 0,
      currentValue: Math.round(currentValue * 100) / 100,
      investedValue: Math.round(investedValue * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 100) / 100,
      sparkline: market.sparkline || [],
      marketName: market.name || h.symbol,
      currency: market.currency || 'INR',
      priceError: market.error || null
    });
  }

  return results;
}

/**
 * Search for a stock symbol
 */
export async function searchSymbol(query) {
  const endpoints = [
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (res.ok) {
        const json = await res.json();
        const quotes = json.quotes || [];
        if (quotes.length > 0) {
          return quotes.map(q => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            exchange: q.exchange,
            type: q.quoteType
          }));
        }
      }
    } catch { /* try next endpoint */ }
  }
  return [];
}
