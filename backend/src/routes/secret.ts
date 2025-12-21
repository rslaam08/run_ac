// backend/src/routes/secret.ts
import express from 'express';
import { ensureJwt } from '../middleware/jwt';
import Record from '../models/Record';
import { getRunbility } from '../utils/runbility';

const router = express.Router();

function getJwtUser(req: express.Request): { seq: number; name?: string; isAdmin?: boolean } | null {
  const a = (req as any).jwtUser;
  const b = (req as any).auth;
  return (a && typeof a.seq === 'number')
    ? a
    : (b && typeof b.seq === 'number')
    ? b
    : null;
}

/**
 * 조건:
 *  i) since(기본 2025-12-22 00:00:00+09:00) 이후 업로드한 기록
 * ii) runbility >= 2000 (timeSec, distance로 서버에서 계산)
 *
 * 환경변수로 테스트 날짜/코드를 바꿀 수 있음:
 *   SECRET_SINCE = '2025-12-14T00:00:00+09:00'
 *   SECRET_CODE  = '(...원하는 문자열...)'
 */
router.get('/check', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    // KST 기준 문자열을 ENV로 받으면 테스트/운영 전환 쉬움
    const sinceStr = process.env.SECRET_SINCE || '2025-12-22T00:00:00+09:00';
    const since = new Date(sinceStr);

    // 필요한 필드만 읽어와 성능/보안 개선
    const cursor = Record.find(
      { userSeq: me.seq, createdAt: { $gte: since } },
      { timeSec: 1, distance: 1, createdAt: 1 }
    ).cursor();

    let qualified = false;

    // 스트리밍으로 순회 → 하나라도 기준 충족하면 통과
    for await (const doc of cursor as any) {
      const timeSec = Number(doc.timeSec);
      const distanceKm = Number(doc.distance);
      if (!Number.isFinite(timeSec) || !Number.isFinite(distanceKm) || distanceKm <= 0) continue;

      const rb = getRunbility(timeSec, distanceKm);
      if (rb >= 2000) {
        qualified = true;
        break;
      }
    }

    if (!qualified) {
      return res.status(403).json({ ok: false, message: 'you are not qualified' });
    }

    const code = process.env.SECRET_CODE || '이 메세지를 캡쳐하여 3509 이승민에게 문의하세요.';
    // 프론트만으로는 알 수 없도록 서버에서만 노출
    return res.json({
      ok: true,
      message: 'well done.... you solved the problem',
      answer: code,
    });
  } catch (e) {
    console.error('[secret/check] error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
