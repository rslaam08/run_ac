// frontend/src/pages/EventPage.tsx
import React, { useEffect, useState } from 'react';
import { eventApi } from '../api/apiClient';
import './EventPage.css';

type Status = {
  eventOpen: boolean;
  moon: number;
  purchases: string[];
  nowSlotId: string;
  isBettingWindow: boolean;
}

type MarketItem = {
  id: string; name: string; price: number; img: string; bought?: boolean;
}

const EventPage: React.FC = () => {
  const [tab, setTab] = useState<'desc'|'casino'|'market'>('desc');
  const [status, setStatus] = useState<Status|null>(null);
  const [amount, setAmount] = useState(''); // 문자열로 받아서 정수 검사
  const [logs, setLogs] = useState<any[]>([]);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadStatus = async () => {
    try {
      const r = await eventApi.status();
      setStatus(r.data);
    } catch (e:any) {
      setStatus(null);
    }
  };

  const loadMarket = async () => {
    try {
      const r = await eventApi.market();
      setItems(r.data.items || []);
    } catch {
      setItems([]);
    }
  };

  const loadAllLogs = async () => {
    try {
      const r = await eventApi.logsAll();
      setLogs(r.data.logs || r.data.bets || []);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadStatus();
    loadMarket();

    // 토큰 페이로드에서 관리자 판단
    try {
      const t = localStorage.getItem('runac_jwt');
      if (t) {
        const [,p] = t.split('.');
        const payload = JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
        setIsAdmin(payload?.seq === 1);
      }
    } catch {}
  }, []);

  useEffect(() => { loadAllLogs(); }, []);

  // 이미지 경로 안전 계산: items[].img 값에 따라 public/event/<basename> 를 우선 사용
  function imgSrcFor(it: MarketItem) {
    const img = it.img || '';
    // 만약 img가 절대 경로(/uploads/xxx.png)라면 basename만 사용
    const basename = img.split('/').pop() || '';
    const publicPrefix = process.env.PUBLIC_URL ?? '';
    // 유저가 실제로 배포 시 public/event/<basename> 에 파일을 넣도록 요구
    if (basename) return `${publicPrefix}/event/${basename}`;
    return `${publicPrefix}/event/${it.id}.png`;
  }

  return (
    <div className="event-page">
      <div className="event-tabs">
        <button className={tab==='desc'?'active':''} onClick={()=>setTab('desc')}>추석 이벤트🌕 안내</button>
        <button className={tab==='casino'?'active':''} onClick={()=>setTab('casino')}>보름달 도박장</button>
        <button className={tab==='market'?'active':''} onClick={()=>setTab('market')}>보름달 마켓</button>
      </div>

      <div className="event-balance">
        보름달 코인 🌕: {Math.floor(status?.moon ?? 0).toLocaleString()}
      </div>

      {tab==='desc' && (
        <section className="event-section">
          <h2>추석 이벤트 안내 🌕</h2>

          <div className="event-desc">
            <p><strong>이벤트 기간:</strong> 2025-10-06 ~ 2025-10-12 (KST)</p>
            <p>달리기를 해서 <strong>보름달 코인🌕</strong>을 쌓고 상품을 받아가세요!</p>
          </div>

          <hr />

          <div className="event-steps">
            <h3>보름달 코인 획득 방법</h3>

            <ol>
              <li>
                <strong>달리기 기록을 올린다</strong><br/>
                달리기마다 다음 공식이 적용돼요 (누적값 아님):<br/>
                <code>🌕 = (🌕<sup>1.5</sup> + (rating)<sup>1.5</sup>)<sup>0.667</sup></code>
              </li>

              <li>
                <strong>도박장에서 코인 도박을 한다</strong><br/>
                보름달 코인을 운명에 맡기면,<br/>
                확률적으로 더 큰 보상을 얻을 수 있어요!
              </li>

              <li>
                <strong>보름달 상점에서 상품을 교환한다</strong><br/>
                코인을 모아 원하는 상품을 받아가세요!<br/>
                각 상품은 한 번만 구매할 수 있습니다.
              </li>
            </ol>
          </div>

          <hr />

          <p style={{ fontSize: '0.9em', color: '#666' }}>
            📜 <a href="https://bit.ly/4nCPxJD" target="_blank" rel="noopener noreferrer">이용약관 보기</a>
          </p>
        </section>
      )}

      {tab==='casino' && (
        <section className="event-section">
          <h2>보름달 도박장</h2>
          <p>각 베팅은 즉시 결과가 결정되어 정산됩니다.</p>

          <div className="bet-box">
            <input
              type="number"
              min={1}
              step={1}
              placeholder="정수를 입력하세요"
              value={amount}
              onChange={(e)=> {
                // 숫자 문자열만 허용 — 빈 문자열 허용 (음수/소수 불허)
                const v = e.target.value;
                if (v === '' || /^\d*$/.test(v)) setAmount(v);
              }}
            />
            <button
              onClick={async ()=> {
                try {
                  const n = Math.floor(Number(amount));
                  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
                    return alert('베팅 금액은 1 이상의 정수로 입력하세요.');
                  }
                  const r = await eventApi.bet(n);
                  // API 응답 구조에 맞춰 표시
                  const bet = r.data.bet ?? r.data;
                  alert(`결과: x${bet.multiplier} → 지급 ${Number(bet.payout).toLocaleString()}🌕\n남은 코인: ${Number(r.data.remain ?? 0).toLocaleString()}`);
                  setAmount('');
                  await loadStatus();
                  await loadAllLogs();
                } catch (e:any) {
                  alert(e?.response?.data?.error || '베팅 실패');
                }
              }}
            >베팅</button>
          </div>

          {/* 🎲 확률표 (토글) */}
          <details style={{ marginTop: '12px', marginBottom: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '1.05rem' }}>
              🎲 도박장 확률 보기
            </summary>
            <div style={{ marginTop: '8px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ccc', background: '#f8f8f8' }}>
                    <th style={{ padding: '6px', textAlign: 'left' }}>배율</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>확률(%)</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>기대 보상</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>설명</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style={{padding:'6px'}}>0×</td><td style={{padding:'6px', textAlign:'right'}}>18.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.00</td><td style={{padding:'6px'}}>모든 코인을 잃습니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>0.25×</td><td style={{padding:'6px', textAlign:'right'}}>7.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.018</td><td style={{padding:'6px'}}>일부만 반환됩니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>0.5×</td><td style={{padding:'6px', textAlign:'right'}}>10.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.05</td><td style={{padding:'6px'}}>절반만 반환됩니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>0.75×</td><td style={{padding:'6px', textAlign:'right'}}>12.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.09</td><td style={{padding:'6px'}}>거의 본전 수준입니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>1×</td><td style={{padding:'6px', textAlign:'right'}}>18.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.18</td><td style={{padding:'6px'}}>본전입니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>1.25×</td><td style={{padding:'6px', textAlign:'right'}}>13.50%</td><td style={{padding:'6px', textAlign:'right'}}>0.16875</td><td style={{padding:'6px'}}>약간의 이득을 얻습니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>1.5×</td><td style={{padding:'6px', textAlign:'right'}}>11.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.165</td><td style={{padding:'6px'}}>확실한 이득입니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>2×</td><td style={{padding:'6px', textAlign:'right'}}>8.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.16</td><td style={{padding:'6px'}}>두 배의 보상을 받습니다.</td></tr>
                  <tr><td style={{padding:'6px'}}>4×</td><td style={{padding:'6px', textAlign:'right'}}>2.00%</td><td style={{padding:'6px', textAlign:'right'}}>0.08</td><td style={{padding:'6px'}}>큰 행운입니다!</td></tr>
                  <tr><td style={{padding:'6px'}}>8×</td><td style={{padding:'6px', textAlign:'right'}}>0.50%</td><td style={{padding:'6px', textAlign:'right'}}>0.04</td><td style={{padding:'6px'}}>매우 희귀한 대박입니다 🎉</td></tr>
                </tbody>
              </table>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '6px' }}>
                총 기댓값 ≈ <b>0.9895배 (−1.05%)</b><br/>
                각 베팅은 독립적인 확률 사건입니다.
              </p>
            </div>
          </details>

          <div className="logs">
            <h3>참여 로그 & 결과</h3>
            {!logs.length && <div>로딩… 혹은 아직 베팅 없음</div>}
            {logs.length > 0 && (
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>닉네임</th>
                    <th>금액</th>
                    <th>배수</th>
                    <th>지급</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l:any) => (
                    <tr key={l._id}>
                      <td>{new Date(l.resolvedAt || l.createdAt).toLocaleString()}</td>
                      <td>{l.userName ?? l.name ?? `#${l.userSeq}`}</td>
                      <td>{Number(l.amount).toLocaleString()}🌕</td>
                      <td>{l.multiplier}x</td>
                      <td>{Number(l.payout).toLocaleString()}🌕</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab==='market' && (
        <section className="event-section">
          <h2>보름달 마켓</h2>

          {(!items || items.length === 0) && (
            <div className="text-gray-500 text-sm mb-2">표시할 상품이 없습니다.</div>
          )}

          <div className="market-grid">
            {items.map(it=>(
              <div key={it.id} className="market-card">
                <div className="img-holder" style={{ width: '100%', height: 120, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={imgSrcFor(it)}
                    alt={it.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', borderRadius: 8 }}
                    onError={(e)=> {
                      // 이미지 없을 때 대체 표시
                      (e.currentTarget as HTMLImageElement).src = `${process.env.PUBLIC_URL || ''}/event/placeholder.png`;
                    }}
                  />
                </div>
                <div className="name">{it.name}</div>
                <div className="price">{it.price.toLocaleString()} 🌕</div>
                <button
                  disabled={!!it.bought}
                  onClick={async ()=> {
                    try {
                      await eventApi.buy(it.id);
                      alert('구매 완료!');
                      await loadStatus();
                      await loadMarket();
                    } catch (e:any) {
                      alert(e?.response?.data?.error || '구매 실패');
                    }
                  }}
                >
                  {it.bought ? '구매완료' : '구매'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default EventPage;
