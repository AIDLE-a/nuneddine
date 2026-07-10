const KR_EXCHANGES = new Set(['KSC', 'KOE', 'KSE', 'Seoul', 'KOSPI', 'KOSDAQ']);

export function getStockCurrency(stock, analysis) {
  const ticker = analysis?.ticker || stock?.code || '';
  const exchange = stock?.exchange || '';

  if (ticker.includes('.KS') || ticker.includes('.KQ') || /^\d{6}$/.test(ticker)) return 'KRW';
  if (exchange && KR_EXCHANGES.has(exchange)) return 'KRW';
  if (exchange.toLowerCase().includes('korea') || exchange.toLowerCase().includes('seoul')) return 'KRW';

  if (ticker.endsWith('.T') || ticker.endsWith('.OS')) return 'JPY';
  if (ticker.endsWith('.HK')) return 'HKD';
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) return 'CNY';
  if (ticker.endsWith('.L')) return 'GBP';
  if (ticker.endsWith('.PA') || ticker.endsWith('.DE') || ticker.endsWith('.AS') || ticker.endsWith('.MI')) return 'EUR';

  return 'USD';
}

export function isKoreanStock(stock, analysis) {
  return getStockCurrency(stock, analysis) === 'KRW';
}

export function formatPrice(price, currencyOrBoolean) {
  const num = Number(price);
  if (!isFinite(num)) return String(price);

  // 하위 호환: boolean(isKorean) 그대로 받을 수도 있음
  if (currencyOrBoolean === true)  return `${num.toLocaleString()}원`;
  if (currencyOrBoolean === false) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  switch (currencyOrBoolean) {
    case 'KRW': return `${num.toLocaleString()}원`;
    case 'JPY': return `¥${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case 'EUR': return `€${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'GBP': return `£${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'HKD': return `HK$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'CNY': return `¥${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
