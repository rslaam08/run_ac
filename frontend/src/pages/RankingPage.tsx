// frontend/src/pages/RankingPage.tsx

import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';    // baseURL: http://localhost:4000/api
import { getRunbility } from '../utils/runbility';
import './RankingPage.css';

/** 숫자별 색상을 반환 */
function getRatingClass(value: number): string {
  if (value < 1000)   return '';
  if (value < 2000)   return 'run-bronze';
  if (value < 3000)   return 'run-silver';
  if (value < 4000)   return 'run-gold';
  if (value < 5500)   return 'run-platinum';
  if (value < 7500)   return 'run-diamond';
  if (value < 10000)  return 'run-ruby';
  if (value < 15000)  return 'run-gradient1';
  if (value < 25000)  return 'run-legend';
  return 'run-gradient2';
}

interface IUser {
  seq:  number;
  name: string;
}

interface IRecord {
  _id:      string;
  timeSec:  number;
  distance: number;
  date:     string;
  imageUrl: string;
}

interface IRank {
  seq:    number;
  name:   string;
  rating: number;
}

interface IBestRun {
  seq:       number;
  name:      string;
  timeSec:   number;
  distance:  number;
  pace:      string;
  runbility: number;
}

interface IRunnerCount {
  seq:   number;
  name:  string;
  count: number;
}

const PAGE_SIZE = 10;

const RankingPage: React.FC = () => {
  const [ratingRanking, setRatingRanking] = useState<IRank[]>([]);
  const [bestRuns, setBestRuns]           = useState<IBestRun[]>([]);
  const [mostRunners, setMostRunners]     = useState<IRunnerCount[]>([]);

  // 페이지 상태
  const [ratingPage, setRatingPage]     = useState(0);
  const [bestRunPage, setBestRunPage]   = useState(0);
  const [runnerPage, setRunnerPage]     = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 1) 모든 유저 목록
        const usersRes = await api.get<IUser[]>('/user');
        const users    = usersRes.data;

        // 2) 승인된 기록 불러오기
        const userRecs = await Promise.all(
          users.map(async u => {
            const recsRes = await api.get<IRecord[]>(`/records/user/${u.seq}`);
            return { user: u, recs: recsRes.data };
          })
        );

        // 3) Rating Ranking
        const rr: IRank[] = userRecs
          .map(({ user, recs }) => {
            if (recs.length === 0) return null;
            const runs = recs
              .map(r => getRunbility(r.timeSec, r.distance))
              .sort((a, b) => b - a);
            const top5 = runs.length >= 5 ? runs.slice(0, 5) : runs;
            const sum  = top5.reduce((s, v) => s + v, 0);
            const rating = sum / 5;
            return { seq: user.seq, name: user.name, rating };
          })
          .filter((x): x is IRank => x !== null)
          .sort((a, b) => b.rating - a.rating);
        setRatingRanking(rr);

        // 4) Best Runs
        const br: IBestRun[] = userRecs
          .flatMap(({ user, recs }) =>
            recs.map(r => {
              const rb = getRunbility(r.timeSec, r.distance);
              const paceSec = Math.round(r.timeSec / (r.distance || 1));
              const m = Math.floor(paceSec / 60);
              const s = paceSec % 60;
              return {
                seq:       user.seq,
                name:      user.name,
                timeSec:   r.timeSec,
                distance:  r.distance,
                pace:      `${m}:${String(s).padStart(2, '0')}`,
                runbility: rb,
              };
            })
          )
          .sort((a, b) => b.runbility - a.runbility);
        setBestRuns(br);

        // 5) Most Runners
        const mr: IRunnerCount[] = userRecs
          .map(({ user, recs }) => ({
            seq:   user.seq,
            name:  user.name,
            count: recs.length,
          }))
          .filter(u => u.count > 0)
          .sort((a, b) => b.count - a.count);
        setMostRunners(mr);

      } catch (err) {
        console.error('랭킹 페이지 데이터 로딩 실패', err);
      }
    };

    fetchAll();
  }, []);

  // 테이블에 보여줄 슬라이스 구하기
  const ratingSlice   = ratingRanking.slice(ratingPage * PAGE_SIZE, ratingPage * PAGE_SIZE + PAGE_SIZE);
  const bestRunSlice  = bestRuns.slice(bestRunPage * PAGE_SIZE, bestRunPage * PAGE_SIZE + PAGE_SIZE);
  const runnerSlice   = mostRunners.slice(runnerPage * PAGE_SIZE, runnerPage * PAGE_SIZE + PAGE_SIZE);

  // 시간 포맷
  const formatTime = (sec: number) =>
    [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60]
      .map(v => String(v).padStart(2, '0'))
      .join(':');

  return (
    <div className="ranking-page">
      {/* i) Rating Ranking */}
      <section className="ranking-section">
        <h2>Rating Ranking</h2>
        <table className="ranking-table">
          <thead>
            <tr><th>순위</th><th>유저</th><th>Rating</th></tr>
          </thead>
          <tbody>
            {ratingSlice.map((u, i) => (
              <tr key={u.seq}>
                <td>{ratingPage * PAGE_SIZE + i + 1}</td>
                <td>{u.name}</td>
                <td>
                  <span
                    className={[
                      'rating-value',
                      getRatingClass(u.rating),
                      u.rating > 10000 ? 'rating-bold' : ''
                    ].join(' ')}
                  >
                    {u.rating.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button onClick={() => setRatingPage(p => Math.max(0, p - 1))} disabled={ratingPage === 0}>
            이전
          </button>
          <button
            onClick={() => setRatingPage(p => p + 1)}
            disabled={(ratingPage + 1) * PAGE_SIZE >= ratingRanking.length}
          >
            다음
          </button>
        </div>
      </section>

      {/* ii) Best Run */}
      <section className="ranking-section">
        <h2>Best Single Run Ranking</h2>
        <table className="ranking-table">
          <thead>
            <tr>
              <th>순위</th><th>유저</th><th>거리(km)</th><th>페이스</th><th>Runbility</th>
            </tr>
          </thead>
          <tbody>
            {bestRunSlice.map((r, i) => (
              <tr key={`${r.seq}-${i}`}>
                <td>{bestRunPage * PAGE_SIZE + i + 1}</td>
                <td>{r.name}</td>
                <td>{r.distance.toFixed(2)}</td>
                <td>{r.pace}</td>
                <td>
                  <span
                    className={[
                      'rating-value',
                      getRatingClass(r.runbility),
                      r.runbility > 10000 ? 'rating-bold' : ''
                    ].join(' ')}
                  >
                    {r.runbility.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button onClick={() => setBestRunPage(p => Math.max(0, p - 1))} disabled={bestRunPage === 0}>
            이전
          </button>
          <button
            onClick={() => setBestRunPage(p => p + 1)}
            disabled={(bestRunPage + 1) * PAGE_SIZE >= bestRuns.length}
          >
            다음
          </button>
        </div>
      </section>

      {/* iii) Most Runner */}
      <section className="ranking-section">
        <h2>Top Runners by Submissions</h2>
        <table className="ranking-table">
          <thead>
            <tr><th>순위</th><th>유저</th><th>제출 횟수</th></tr>
          </thead>
          <tbody>
            {runnerSlice.map((u, i) => (
              <tr key={u.seq}>
                <td>{runnerPage * PAGE_SIZE + i + 1}</td>
                <td>{u.name}</td>
                <td>{u.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button onClick={() => setRunnerPage(p => Math.max(0, p - 1))} disabled={runnerPage === 0}>
            이전
          </button>
          <button
            onClick={() => setRunnerPage(p => p + 1)}
            disabled={(runnerPage + 1) * PAGE_SIZE >= mostRunners.length}
          >
            다음
          </button>
        </div>
      </section>
    </div>
  );
};

export default RankingPage;
