import React, { useState } from 'react';
import { getRunbility } from '../utils/runbility';
import './RunbilityCalculator.css';

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

function parseMMSS(mmss: string): number | null {
  const [mStr, sStr] = (mmss || '').split(':');
  const m = Number(mStr);
  const s = Number(sStr);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (s < 0 || s >= 60 || m < 0) return null;
  return m * 60 + s;
}

function formatHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

const RunbilityCalculator: React.FC = () => {
  const [pace, setPace] = useState('05:00'); // MM:SS per km
  const [distance, setDistance] = useState('1.00'); // km

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);

  const calculate = () => {
    setError(null);
    setResult(null);
    setTotalTime(null);

    const paceSec = parseMMSS(pace);
    const dist = Number(distance);

    if (paceSec == null) {
      setError('페이스 형식이 올바르지 않습니다. (예: 05:00)');
      return;
    }
    if (paceSec < 160 || paceSec > 420) {
      setError('페이스는 2:40 ~ 7:00 사이만 허용됩니다.');
      return;
    }

    if (!Number.isFinite(dist)) {
      setError('거리 형식이 올바르지 않습니다.');
      return;
    }
    if (dist < 0.5 || dist > 10) {
      setError('거리는 0.5km 이상 10km 이하만 허용됩니다.');
      return;
    }

    const timeSec = paceSec * dist; // 총 시간(초)
    const rb = getRunbility(timeSec, dist);
    setTotalTime(timeSec);
    setResult(rb);
  };

  return (
    <div className="calc-wrapper calc-page-root">
      <h2>Runbility 계산기</h2>

      <div className="calc-form">
        <div className="form-row">
          <label>1km 페이스 (MM:SS)</label>
          <input
            type="text"
            value={pace}
            onChange={e => setPace(e.target.value)}
            placeholder="예: 05:00"
          />
        </div>
        <div className="form-row">
          <label>거리 (km)</label>
          <input
            type="number"
            step="0.01"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            placeholder="예: 5"
          />
        </div>
        <button className="calc-btn" onClick={calculate}>계산</button>

        {error && <div className="calc-error">{error}</div>}

        {result != null && (
          <div className="calc-result">
            <div>총 시간: <span>{formatHMS(totalTime || 0)}</span></div>
            <div>
              Runbility:&nbsp;
              <span className={getRunClass(result)}>
                {result.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      <p className="calc-note">
      </p>
    </div>
  );
};

export default RunbilityCalculator;
