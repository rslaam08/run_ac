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
          <h2>페이지 설명</h2>
          <p>이벤트 기간: 2025-10-06 ~ 2025-10-12 (KST)</p>
          <p>달리기를 해서 보름달 코인🌕을 쌓고 상품을 받아가세요!</p>
          <p></p>
          <p>🌕 획득 방법</p>
          <p>1, 달리기 기록을 올린다</p>
          <p>달리기마다 🌕 = (🌕^1.5 + (rating)^1.5)^0.667</p>
          <p>의 공식으로 🌕를 얻을 수 있어요!</p>
          <p></p>
          <p>2, 도박장에서 코인 도박을 한다</p>

          <p>여러분은 보름달 코인🌕을 운명에 맡길 수 있으며</p>
          <p>확률적으로 더 큰 보상을 얻게 됩니다!</p>
          <p></p>
          <p>3, 보름달 코인🌕을 모은 후 보름달 상점 페이지에서 원하는 상품을 받아가세요!</p>
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
              placeholder="정수 단위로 베팅 금액"
              value={amount}
              onChange={(e)=> {
                // 숫자 문자열만 허용 — 빈 문자열 허용
                const v = e.target.value;
                // allow empty, or digits only (음수/소수 허용X)
                if (v === '' || /^-?\d*$/.test(v)) setAmount(v);
              }}
            />
            <button
              onClick={async ()=> {
                try {
                  const n = Number(amount);
                  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
                    return alert('베팅 금액은 1 이상의 정수로 입력하세요.');
                  }
                  const r = await eventApi.bet(n);
                  // API 응답 구조에 맞춰 표시
                  const bet = r.data.bet ?? r.data;
                  alert(`결과: x${bet.multiplier} → 지급 ${Number(bet.payout).toLocaleString()}🌕\n남은 코인: ${Number(r.data.remain ?? r.data.remain ?? 0).toLocaleString()}`);
                  setAmount('');
                  await loadStatus();
                  await loadAllLogs();
                } catch (e:any) {
                  alert(e?.response?.data?.error || '베팅 실패');
                }
              }}
            >베팅</button>
          </div>

          <div className="logs">
            <h3>참여 로그 & 결과 (최근)</h3>
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
