// frontend/src/pages/MainPage.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { getRunbility } from '../utils/runbility';
import './MainPage.css';

function getRatingClass(value: number): string {
  if (value < 1000)   return '';
  if (value < 2000)   return 'run-bronze';
  if (value < 3000)   return 'run-silver';
  if (value < 4000)   return 'run-gold';
  if (value < 5500)   return 'run-platinum';
  if (value < 7500)   return 'run-diamond';
  if (value < 10000)  return 'run-ruby';
  if (value < 15000)  return 'run-gradient1-text';  // Master
  return 'run-gradient2-text';                       // The Lord of Running
}

interface IUser { seq: number; name: string; }
interface IRecord { timeSec: number; distance: number; date: string; }
interface IRank { seq: number; name: string; rating: number; }

const MainPage: React.FC = () => {
  const [ranking, setRanking] = useState<IRank[]>([]);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const usersRes = await api.get<IUser[]>('/user');
        const users = usersRes.data;

        const allData = await Promise.all(
          users.map(async (u) => {
            const recsRes = await api.get<IRecord[]>(`/records/user/${u.seq}`);
            const recs = recsRes.data;
            if (recs.length === 0) return null;

            const runs = recs.map(r => getRunbility(r.timeSec, r.distance)).sort((a,b)=>b-a);
            let avg:number;
            if (runs.length >= 5) avg = runs.slice(0,5).reduce((s,v)=>s+v,0)/5;
            else                  avg = runs.reduce((s,v)=>s+v,0)/5;

            return { seq:u.seq, name:u.name, rating:avg };
          })
        );

        const filtered = allData.filter((x): x is IRank => x !== null)
                                .sort((a,b)=>b.rating-a.rating);
        setRanking(filtered);
      } catch (err) {
        console.error('랭킹 조회 실패', err);
      }
    };
    fetchRanking();
  }, []);

  return (
    <div className="main-container">
      <section className="intro">
        <h1>run.ac</h1>
        <h3>서울과학고 피무브 공식 사이트</h3>
        <p>당신의 달리기 데이터를 기록하고<br/>다른 사람과 경쟁하세요!</p>
      </section>

      <section className="site-guide">
        <h3>run.ac를 사용하는 방법</h3>
        <p>
          1, 휴대폰의 Nike Run Club 등의 어플로 달리기 기록을<br/>
          측정하고, 스크린샷을 찍는다.<br/>
          2, 로그인 후 마이 페이지로 들어가서<br/>
          기록 정보와 함께 스크린샷을 제출한다.<br/>
          3, 관리자의 판단 하에 24시간 내로 <br/>
          기록이 승인되는 것을 기다린다. <br/>
        </p>
      </section>

      <section className="ranking">
        <h3>Rating Ranking</h3>
        <table className="ranking-table">
          <thead>
            <tr><th>순위</th><th>유저</th><th>Rating</th></tr>
          </thead>
          <tbody>
            {ranking.slice(0,5).map((user, idx) => (
              <tr key={user.seq}>
                <td>{idx + 1}</td>
                <td>{user.name}</td>
                <td>
                  <span className={[
                      getRatingClass(user.rating),
                      user.rating > 10000 ? 'rating-bold' : ''
                    ].join(' ')}>
                    {user.rating.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rating-legend">
        <h3>Rating/Runbility 안내</h3>
        <div className="legend-table-wrap">
          <table className="legend-table">
            <thead>
              <tr><th>칭호</th><th>IV</th><th>III</th><th>II</th><th>I</th></tr>
            </thead>
            <tbody>
              <tr className="run-bronze"><td>Bronze</td><td>1000 ~ 1250</td><td>1250 ~ 1500</td><td>1500 ~ 1750</td><td>1750 ~ 2000</td></tr>
              <tr className="run-silver"><td>Silver</td><td>2000 ~ 2250</td><td>2250 ~ 2500</td><td>2500 ~ 2750</td><td>2750 ~ 3000</td></tr>
              <tr className="run-gold"><td>Gold</td><td>3000 ~ 3250</td><td>3250 ~ 3500</td><td>3500 ~ 3750</td><td>3750 ~ 4000</td></tr>
              <tr className="run-platinum"><td>Platinum</td><td>4000 ~ 4300</td><td>4300 ~ 4700</td><td>4700 ~ 5100</td><td>5100 ~ 5500</td></tr>
              <tr className="run-diamond"><td>Diamond</td><td>5500 ~ 6000</td><td>6000 ~ 6500</td><td>6500 ~ 7000</td><td>7000 ~ 7500</td></tr>
              <tr className="run-ruby"><td>Ruby</td><td>7500 ~ 8100</td><td>8100 ~ 8700</td><td>8700 ~ 9300</td><td>9300 ~ 10000</td></tr>
              <tr className="legend-emphasis">
                <td colSpan={4}><span className="gradient1-text">Master</span></td>
                <td><span className="gradient1-text">10000 ~</span></td>
              </tr>
              <tr className="legend-emphasis">
                <td colSpan={4}><span className="gradient2-text">The Lord of Running</span></td>
                <td><span className="gradient2-text">15000 ~</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h6 className="legend-footnote">
          기록에 따른 runblility: bit.ly/41p8YMG<br/>
          만약 기록이 표에 표기된 축의 사잇값이라면, 선형적으로 처리합니다.
        </h6>
      </section>
    </div>
  );
};

export default MainPage;
