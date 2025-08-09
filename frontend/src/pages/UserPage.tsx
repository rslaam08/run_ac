// frontend/src/pages/UserPage.tsx
import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, authApi, getAuthToken } from '../api/apiClient';
import { getRunbility } from '../utils/runbility';
import './UserPage.css';

interface IUser {
  name: string;
  intro: string;
  seq: number;
}

interface IRecord {
  _id: string;
  timeSec: number;
  distance: number;
  date: string;
}

const PAGE_SIZE = 10;

const getRunClass = (val: number) => {
  if (val >= 15000) return 'run-gradient2';
  if (val >= 10000) return 'run-gradient1';
  if (val >= 7500)  return 'run-ruby';
  if (val >= 5500)  return 'run-diamond';
  if (val >= 4000)  return 'run-platinum';
  if (val >= 3000)  return 'run-gold';
  if (val >= 2000)  return 'run-silver';
  if (val >= 1000)  return 'run-bronze';
  return '';
};

// 평균 Top 5 runbility에 따른 칭호(title) 매핑 함수
const getRunTitle = (avg: number): string => {
  if (avg >= 15000) return 'The Lord of Running';
  if (avg >= 10000) return 'Master';
  if (avg >= 9300)  return 'Ruby I';
  if (avg >= 8700)  return 'Ruby II';
  if (avg >= 8100)  return 'Ruby III';
  if (avg >= 7500)  return 'Ruby IV';
  if (avg >= 7000)  return 'Diamond I';
  if (avg >= 6500)  return 'Diamond II';
  if (avg >= 6000)  return 'Diamond III';
  if (avg >= 5500)  return 'Diamond IV';
  if (avg >= 5100)  return 'Platinum I';
  if (avg >= 4700)  return 'Platinum II';
  if (avg >= 4300)  return 'Platinum III';
  if (avg >= 4000)  return 'Platinum IV';
  if (avg >= 3750)  return 'Gold I';
  if (avg >= 3500)  return 'Gold II';
  if (avg >= 3250)  return 'Gold III';
  if (avg >= 3000)  return 'Gold IV';
  if (avg >= 2750)  return 'Silver I';
  if (avg >= 2500)  return 'Silver II';
  if (avg >= 2250)  return 'Silver III';
  if (avg >= 2000)  return 'Silver IV';
  if (avg >= 1750)  return 'Bronze I';
  if (avg >= 1500)  return 'Bronze II';
  if (avg >= 1250)  return 'Bronze III';
  if (avg >= 1000)  return 'Bronze IV';
  return 'Unrated';
};

// JWT payload(= seq) 빠르게 읽어오기 (업로드 폼 표시용)
function getTokenPayload(): null | { seq?: number; name?: string; isAdmin?: boolean } {
  try {
    const t = getAuthToken();
    if (!t) return null;
    const [, payload] = t.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const UserPage: React.FC = () => {
  const { seq } = useParams<{ seq: string }>();
  const userSeq = Number(seq);

  const [user, setUser] = useState<IUser | null>(null);
  const [page, setPage] = useState(0);
  const [currentSeq, setCurrentSeq] = useState<number | null>(null);
  const [records, setRecords] = useState<IRecord[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'runbility'>('date');

  const [editing, setEditing] = useState(false);
  const [introInput, setIntroInput] = useState('');
  const [savingIntro, setSavingIntro] = useState(false);

  const [timeInput, setTimeInput] = useState('00:00:00');
  const [distInput, setDistInput] = useState('0');
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [fileInput, setFileInput] = useState<File | null>(null);

  // 날짜 제한(오늘 ~ 7일 전)
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 유저/기록 로드
  useEffect(() => {
    if (!seq) return;
    api.get<IUser>(`/user/${userSeq}`)
      .then(res => setUser(res.data))
      .catch(() => console.error('유저 조회 실패'));
    api.get<IRecord[]>(`/records/user/${userSeq}`)
      .then(res => setRecords(res.data))
      .catch(() => console.error('기록 조회 실패'));
  }, [userSeq, seq]);

  // 현재 로그인 사용자 seq 세팅 (토큰 → /auth/me 순서)
  useEffect(() => {
    const p = getTokenPayload();
    if (p?.seq) setCurrentSeq(p.seq);

    authApi.get<{ seq: number }>('/me')
      .then(res => setCurrentSeq(res.data.seq))
      .catch(() => {
        if (!p?.seq) setCurrentSeq(null);
      });
  }, []);

  const startEdit = () => {
    if (user) {
      setIntroInput(user.intro);
      setEditing(true);
    }
  };

  // ✅ 소개 저장(토큰을 확실히 헤더에 부착 + 에러 표시)
  const saveIntro = async () => {
    if (!user) return;
    if (introInput.trim() === (user.intro || '').trim()) {
      setEditing(false);
      return;
    }
    try {
      setSavingIntro(true);
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await api.put<IUser>(
        `/user/${user.seq}`,
        { intro: introInput },
        { headers }
      );
      setUser(res.data);
      setEditing(false);
      alert('소개가 저장되었습니다.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        '알 수 없는 오류';
      console.error('[intro save] error:', err?.response || err);
      alert(`소개 저장 실패: ${msg}`);
    } finally {
      setSavingIntro(false);
    }
  };

  // HH:MM:SS -> 총 초수
  const parseHmsToSeconds = (hms: string): number | null => {
    const m = hms.trim().match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    const s = Number(m[3]);
    return h * 3600 + mi * 60 + s;
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();

    // 거리: 0.5 ~ 10
    const distance = Number(distInput);
    if (Number.isNaN(distance)) {
      alert('거리를 숫자로 입력하세요.');
      return;
    }
    if (distance < 0.5 || distance > 10) {
      alert('거리는 0.5km 이상 10km 이하만 업로드할 수 있습니다.');
      return;
    }

    // 시간 파싱
    const timeSec = parseHmsToSeconds(timeInput);
    if (timeSec === null || timeSec <= 0) {
      alert('총 시간을 HH:MM:SS 형식으로 올바르게 입력하세요.');
      return;
    }

    // 페이스: 180 ~ 420초/1km
    const paceSecPerKm = timeSec / distance;
    if (paceSecPerKm < 180 || paceSecPerKm > 420) {
      alert('1km 페이스가 180초(3:00) 이상, 420초(7:00) 이하인 기록만 업로드할 수 있습니다.');
      return;
    }

    // 날짜: 오늘 ~ 7일 전
    if (!dateInput) {
      alert('날짜를 선택하세요.');
      return;
    }
    const d = new Date(dateInput);
    const minD = new Date(weekAgoIso);
    const maxD = new Date(todayIso);
    if (isNaN(d.getTime()) || d < minD || d > maxD) {
      alert(`날짜는 ${weekAgoIso}부터 ${todayIso} 사이만 선택할 수 있습니다.`);
      return;
    }

    if (!fileInput) { alert('이미지를 선택하세요'); return; }

    const formData = new FormData();
    formData.append('time', timeInput);
    formData.append('distance', distInput);
    formData.append('date', dateInput);
    formData.append('image', fileInput);

    try {
      await api.post('/records', formData);
      alert('승인 대기 중인 기록이 등록되었습니다.');
      setTimeInput('00:00:00');
      setDistInput('0');
      setDateInput(new Date().toISOString().slice(0,10));
      setFileInput(null);
      const res = await api.get<IRecord[]>(`/records/user/${userSeq}`);
      setRecords(res.data);
    } catch (err: any) {
      console.error('업로드 실패:', err?.response?.data || err);
      alert('업로드 중 오류가 발생했습니다.');
    }
  };

  if (!user) return <div className="loading">로딩 중…</div>;

  // runbility 계산 및 정렬/페이지
  const recordsWithRun = records.map(r => ({
    ...r,
    runbility: getRunbility(r.timeSec, r.distance)
  }));
  const top5Sum = recordsWithRun
    .map(r => r.runbility)
    .sort((a,b) => b - a)
    .slice(0,5)
    .reduce((sum,v) => sum + v, 0);
  const top5Avg = top5Sum / 5;

  const sortedRecords = [...recordsWithRun].sort((a,b) =>
    sortBy === 'date'
      ? new Date(b.date).getTime() - new Date(a.date).getTime()
      : b.runbility - a.runbility
  );
  const paged = sortedRecords.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE
  );

  const formatTime = (sec: number) => {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
  };
  const calcPace = (timeSec: number, distance: number) => {
    const total = Math.round(timeSec/(distance||1));
    const m = Math.floor(total/60), s = total%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  return (
    <div className="container user-page-root">
      <h1 className="user-header">
        <span
          className={getRunClass(top5Avg)}
          style={{marginRight: '0.5rem', fontWeight: 'bold', fontSize: '0.7em'}}
        >
          {getRunTitle(top5Avg)}
        </span>
        {user.name}
      </h1>

      <small className="user-seq">id: {user.seq}</small>

      <div className="intro-card">
        {!editing && <p>{user.intro || '소개가 없습니다.'}</p>}
        {editing && (
          <textarea
            className="intro-textarea"
            rows={4}
            value={introInput}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setIntroInput(e.target.value)}
          />
        )}
        {currentSeq === user.seq && !editing && (
          <button className="edit-btn" onClick={startEdit}>수정</button>
        )}
        {editing && (
          <div className="edit-controls">
            <button className="save-btn" onClick={saveIntro} disabled={savingIntro}>
              {savingIntro ? '저장 중…' : '저장'}
            </button>
            <button className="cancel-btn" onClick={() => setEditing(false)} disabled={savingIntro}>
              취소
            </button>
          </div>
        )}
      </div>

      <div className="sort-select">
        <label>정렬:</label>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)}>
          <option value="date">날짜순</option>
          <option value="runbility">Runbility순</option>
        </select>
      </div>

      <div className="records-section">
        <div className="mt-4 font-semibold">Runbility rating:{' '}
          <span className={getRunClass(top5Avg)}>
            {top5Avg.toFixed(2)}
          </span>
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            color:     '#6B7280',
            marginTop: '1rem',
          }}
        >
          *rating은 상위 5개 Runbility의 평균입니다.
        </div>

        <table className="records-table">
          <thead>
            <tr>
              <th>날짜</th><th>시간</th><th>거리(km)</th><th>페이스</th><th>Runbility</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(rec => (
              <tr key={rec._id}>
                <td>{new Date(rec.date).toLocaleDateString()}</td>
                <td>{formatTime(rec.timeSec)}</td>
                <td>{rec.distance.toFixed(2)}</td>
                <td>{calcPace(rec.timeSec, rec.distance)}</td>
                <td className={`px-4 py-2 ${getRunClass(rec.runbility)}`}>
                  {rec.runbility.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ——— 페이지 네비게이션 (table 밖) ——— */}
        <div className="pager" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            이전
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= sortedRecords.length}
          >
            다음
          </button>
        </div>
      </div>

      {currentSeq === user.seq && (
        <form onSubmit={handleUpload} className="upload-form">
          <h2><br/><br/>새 기록 업로드</h2>
          <div>
            <label><br/>총 시간 (HH:MM:SS)</label>
            <input
              type="text"
              value={timeInput}
              onChange={e=>setTimeInput(e.target.value)}
              placeholder="HH:MM:SS"
              pattern="^\\d{1,2}:[0-5]\\d:[0-5]\\d$"
              title="예: 00:45:30"
              required
            />
          </div>
          <div>
            <label><br/>거리 (km)</label>
            <input
              type="number"
              step="0.01"
              min={0.5}
              max={10}
              value={distInput}
              onChange={e=>setDistInput(e.target.value)}
              required
            />
          </div>
          <div>
            <label><br/>날짜</label>
            <input
              type="date"
              value={dateInput}
              onChange={e=>setDateInput(e.target.value)}
              min={weekAgoIso}
              max={todayIso}
              required
            />
          </div>
          <div>
            <label><br/>이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={e=>setFileInput(e.target.files?.[0]||null)}
              required
            />
          </div>
          <br/>
          <button type="submit">업로드</button>
        </form>
      )}
    </div>
  );
};

export default UserPage;
