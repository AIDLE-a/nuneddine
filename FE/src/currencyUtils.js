// 한국 거래소 식별자 목록 (야후 파이낸스 exchDisp 기준)
const KR_EXCHANGES = new Set(['KSC', 'KOE', 'KSE', 'Seoul', 'KOSPI', 'KOSDAQ']);

export function isKoreanStock(stock, analysis) {
  const ticker = analysis?.ticker || stock?.code || '';
  const exchange = stock?.exchange || '';

  // 티커 코드 패턴: 숫자6자리 또는 .KS / .KQ 접미사
  if (ticker.includes('.KS') || ticker.includes('.KQ')) return true;
  if (/^\d{6}$/.test(ticker)) return true;

  // 거래소 정보가 있으면 활용
  if (exchange && KR_EXCHANGES.has(exchange)) return true;
  if (exchange.toLowerCase().includes('korea') || exchange.toLowerCase().includes('seoul')) return true;

  return false;
}

export function formatPrice(price, isKorean) {
  if (isKorean) return `${Number(price).toLocaleString()}원`;
  return `$${Number(price).toLocaleString()}`;
}
