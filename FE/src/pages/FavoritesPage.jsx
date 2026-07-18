import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_STOCKS } from '../App.jsx';
import { fetchPrices } from '../api.js';
import { getStockCurrency, formatPrice } from '../currencyUtils.js';

const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'HKD'];
const CURRENCY_SYMBOLS = { KRW: '₩', USD: '$', JPY: '¥', EUR: '€', HKD: 'HK$' };

function makeStockObj(ticker, name) {
  return MOCK_STOCKS.find(s => s.code === ticker) ?? {
    name, code: ticker, price: '-', change: '-', isPositive: true,
    predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
    newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
  };
}

function PurchaseInput({ ticker, current, onSave, onCancel }) {
  const currency = getStockCurrency({ code: ticker });
  const defaultCur = currency === '원' ? 'KRW' : 'USD';
  const [price, setPrice] = useState(current?.purchasePrice ?? '');
  const [cur, setCur] = useState(current?.purchaseCurrency ?? defaultCur);

  return (
    <div className="fav-purchase-input-row">
      <select className="fav-currency-select" value={cur} onChange={e => setCur(e.target.value)}>
        {CURRENCIES.map(c => (
          <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</option>
        ))}
      </select>
      <input
        className="fav-price-input"
        type="number"
        placeholder="구매 가격 입력"
        value={price}
        onChange={e => setPrice(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(Number(price), cur); if (e.key === 'Escape') onCancel(); }}
        autoFocus
      />
      <button className="fav-save-btn" onClick={() => onSave(Number(price), cur)} disabled={!price}>저장</button>
      <button className="fav-cancel-btn" onClick={onCancel}>취소</button>
    </div>
  );
}

function FavoriteItem({ f, priceData, onRemove, onUpdatePurchase, onAnalyze }) {
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();

  const price = priceData?.price;
  const changePct = priceData?.change_pct;
  const currency = getStockCurrency({ code: f.ticker });
  const priceStr = price != null ? formatPrice(price, currency) : '—';
  const isPos = changePct != null ? changePct >= 0 : null;

  const hasPurchase = f.purchasePrice != null && f.purchasePrice > 0;
  let gainAmt = null, gainPct = null;
  if (hasPurchase && price != null) {
    gainAmt = price - f.purchasePrice;
    gainPct = (gainAmt / f.purchasePrice) * 100;
  }

  const handleSave = async (purchasePrice, purchaseCurrency) => {
    await onUpdatePurchase(f.ticker, purchasePrice || null, purchaseCurrency);
    setEditing(false);
  };

  return (
    <div className="fav-item">
      {/* 왼쪽: 종목 정보 */}
      <div className="fav-item-info">
        <span className="ranking-ticker">{f.ticker}</span>
        <span className="ranking-name">{f.name}</span>
      </div>

      {/* 중앙: 현재가 + 등락률 + 손익 */}
      <div className="fav-item-price-area">
        <div className="fav-item-price-row">
          <span className="fav-item-price">{priceStr}</span>
          {changePct != null && (
            <span className={`fav-change-badge ${isPos ? 'positive' : 'negative'}`}>
              {isPos ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
        {hasPurchase && gainAmt != null && (
          <div className="fav-item-gain">
            <span className="fav-gain-label">매수가 {CURRENCY_SYMBOLS[f.purchaseCurrency]}{f.purchasePrice.toLocaleString()}</span>
            <span className={`fav-gain-value ${gainAmt >= 0 ? 'positive' : 'negative'}`}>
              {gainAmt >= 0 ? '+' : ''}{formatPrice(Math.abs(gainAmt), currency)}
              {' '}({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
            </span>
          </div>
        )}
        {editing && (
          <PurchaseInput ticker={f.ticker} current={f} onSave={handleSave} onCancel={() => setEditing(false)} />
        )}
      </div>

      {/* 오른쪽: 버튼들 */}
      <div className="fav-item-actions">
        <button className="fav-purchase-btn" onClick={() => setEditing(e => !e)}>
          {hasPurchase ? '✏️ 매수가 수정' : '+ 매수가 입력'}
        </button>
        <button className="ranking-analyze-btn" onClick={() => { onAnalyze(makeStockObj(f.ticker, f.name)); navigate('/'); }}>
          분석 시작 →
        </button>
        <button className="btn-icon btn-danger" onClick={() => onRemove(f.ticker)} title="관심 종목 해제">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}

function FavoritesPage({ favorites, user, onRemoveFavorite, onUpdatePurchase, onAnalyze }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [prices, setPrices] = useState({});

  useEffect(() => {
    if (favorites.length === 0) return;
    fetchPrices(favorites.map(f => f.ticker))
      .then(data => setPrices(data))
      .catch(() => {});
  }, [favorites]);

  const purchased = favorites.filter(f => f.purchasePrice != null && f.purchasePrice > 0);
  const displayed = tab === 'all' ? favorites : purchased;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">관심 종목</h1>
        <p className="page-subtitle">분석 화면의 ☆ 버튼으로 관심 종목을 추가하세요</p>
      </div>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <p className="empty-state-text">저장된 관심 종목이 없습니다</p>
          <button className="btn-primary" onClick={() => navigate('/')}>종목 분석하러 가기</button>
        </div>
      ) : (
        <>
          <div className="fav-tab-row">
            <button className={`fav-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>
              전체 관심 종목 <span className="fav-tab-count">{favorites.length}</span>
            </button>
            <button className={`fav-tab${tab === 'purchased' ? ' active' : ''}`} onClick={() => setTab('purchased')}>
              내가 구매한 종목 <span className="fav-tab-count">{purchased.length}</span>
            </button>
          </div>

          {displayed.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 32 }}>
              <p className="empty-state-text">매수가를 입력한 종목이 없습니다</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>종목 카드의 '+ 매수가 입력'을 눌러 등록하세요</p>
            </div>
          ) : (
            <div className="ranking-list">
              {displayed.map(f => (
                <FavoriteItem
                  key={f.ticker}
                  f={f}
                  priceData={prices[f.ticker]}
                  onRemove={onRemoveFavorite}
                  onUpdatePurchase={onUpdatePurchase}
                  onAnalyze={onAnalyze}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FavoritesPage;
