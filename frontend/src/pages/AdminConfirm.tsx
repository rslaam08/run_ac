// frontend/src/pages/AdminConfirm.tsx

import React, { useEffect, useState } from 'react';
import { api, authApi } from '../api/apiClient';  // ✅ 여기서 가져옵니다
import './AdminConfirm.css';

interface IRec {
  _id:     string;
  userSeq: number;
  timeSec: number;
  distance:number;
  date:    string;
  imageUrl:string;
}

const AdminConfirm: React.FC = () => {
  const [records, setRecs] = useState<IRec[]>([]);
  const [isAdmin, setAdmin]= useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // JWT 헤더가 자동으로 붙는 authApi 사용
    authApi.get('/me')
      .then(res => {
        if (res.data?.isAdmin) {
          setAdmin(true);
          return api.get<IRec[]>('/records/pending');
        }
        // 관리자가 아니면 빈 배열 반환
        setAdmin(false);
        return { data: [] as IRec[] };
      })
      .then(r => setRecs(r.data))
      .catch(err => {
        console.error('🛑 /auth/me or /records/pending failed:', err?.response?.data || err);
        setAdmin(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>로딩 중…</div>;
  if (!isAdmin) return <div>접근 권한이 없습니다.</div>;

  const approve = (id: string) =>
    api.put(`/records/${id}/approve`)
       .then(() => setRecs(rs => rs.filter(r => r._id !== id)))
       .catch(err => console.error('승인 실패:', err?.response?.data || err));

  const reject = (id: string) =>
    api.put(`/records/${id}/reject`)
       .then(() => setRecs(rs => rs.filter(r => r._id !== id)))
       .catch(err => console.error('거절 실패:', err?.response?.data || err));

  const formatTime = (sec: number) => {
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec % 3600)/60);
    const s = sec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">달리기 기록 승인</h1>
      {records.map(r => (
        <div key={r._id} className="border p-3 my-2">
          <p>유저 #{r.userSeq}</p>
          <p>시간: {formatTime(r.timeSec)}</p>
          <p>거리: {r.distance.toFixed(2)} km</p>
          <p>날짜: {new Date(r.date).toLocaleDateString()}</p>
          <img
            src={r.imageUrl}
            alt=""
            className="record-image mt-2"
          />
          <div className="mt-2">
            <button
              onClick={() => approve(r._id)}
              className="mr-2 px-3 py-1 bg-green-500 text-white rounded"
            >
              승인
            </button>
            <button
              onClick={() => reject(r._id)}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              거절
            </button>
          </div>
        </div>
      ))}
      {records.length === 0 && <p>대기 중인 기록이 없습니다.</p>}
    </div>
  );
};

export default AdminConfirm;
