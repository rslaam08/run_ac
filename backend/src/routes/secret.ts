// backend/src/routes/secret.ts
import express from 'express';
import { ensureJwt } from '../middleware/jwt';
import User from '../models/User';
// ⚠️ 아래 Record 모델 이름/필드명은 프로젝트 기준으로 바꿔주세요.
// 예: models/Record.ts 에 runbility(=rating)와 createdAt 이 있다고 가정.
import Record from '../models/Record';

const router = express.Router();

/** JWT 페이로드 헬퍼 (프로젝트에 이미 쓰던 패턴) */
function getJwtUser(req: express.Request): { seq: number; name?: string; isAdmin?: boolean } | null {
  const a = (req as any).jwtUser;
  const b = (req as any).auth;
  return (a && typeof a.seq === 'number') ? a
       : (b && typeof b.seq === 'number') ? b
       : null;
}

/**
 * GET /api/secret/check
 * 조건:
 *  i) 2025-12-22(포함) 이후 업로드한 기록 존재
 * ii) runbility(또는 rating) >= 2000
 * 자격 미달이면 403 + "you are not qualified"
 * 자격 충족이면 200 + "well done.... the secret code is (answer)"
 */
router.get('/check', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    // KST 2025-12-22 00:00:00
    const since = new Date('2025-12-13T00:00:00+09:00');

    // ⚠️ 필드명 확인: runbility 필드명이 'runbility'인지 'rating'인지 프로젝트에 맞추세요.
    // createdAt 은 Mongoose timestamps 로 있다고 가정.
    const hasQualified = await Record.exists({
      userSeq: me.seq,                // 또는 seq, ownerSeq 등 프로젝트 스키마에 맞게
      runbility: { $gte: 2000 },      // 또는 rating: { $gte: 2000 }
      createdAt: { $gte: since },
    });

    if (!hasQualified) {
      // 자격 미달: 정답 절대 노출 안 함
      return res.status(403).json({ ok: false, message: 'you are not qualified' });
    }

    // 자격 충족: 정답은 서버의 환경변수나 안전한 저장소에서만 로드
    const code = process.env.SECRET_CODE || '(answer)';
    return res.json({
      ok: true,
      message: `well done.... the secret code is (answer)`,
      answer: code, // 프론트는 이 값을 UI에 띄우기만 함
    });
  } catch (e) {
    console.error('[secret/check] error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
