// backend/src/routes/user.ts
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

/** JWT 페이로드 타입 */
type AuthPayload = {
  seq: number;
  name: string;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
};

/** Authorization: Bearer <token> 검사 */
function ensureJwt(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ message: 'Unauthorized (no token)' });

    const token = m[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[JWT] JWT_SECRET is missing');
      return res.status(500).json({ message: 'Server misconfigured' });
    }

    const payload = jwt.verify(token, secret) as AuthPayload;
    (req as any).auth = payload;
    return next();
  } catch (e: any) {
    console.warn('[JWT] verify failed:', e?.message);
    return res.status(401).json({ message: 'Unauthorized (invalid token)' });
  }
}

/** 유저 목록(간단 정보) */
router.get('/', async (_req, res) => {
  try {
    const users = await User.find().lean();
    const list = users.map(u => ({ seq: u.seq, name: u.name }));
    res.json(list);
  } catch (err) {
    console.error('유저 목록 조회 실패', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/** 유저 정보 조회 */
router.get('/:seq', async (req: Request, res: Response) => {
  const seq = Number(req.params.seq);
  if (!Number.isFinite(seq)) return res.status(400).json({ message: 'Bad seq' });

  const user = await User.findOne({ seq }).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({ name: user.name, intro: user.intro, seq: user.seq });
});

/** 자기소개 수정 (본인만) — JWT 인증 */
router.put('/:seq', ensureJwt, async (req: Request, res: Response) => {
  const seqParam = Number(req.params.seq);
  if (!Number.isFinite(seqParam)) return res.status(400).json({ message: 'Bad seq' });

  const auth = (req as any).auth as AuthPayload | undefined;
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });
  if (auth.seq !== seqParam) return res.status(403).json({ message: 'Forbidden' });

  let { intro } = (req.body as { intro?: string }) || {};
  intro = (intro ?? '').toString().trim();

  // (선택) 길이 제한
  if (intro.length > 500) {
    return res.status(400).json({ message: 'Intro too long (max 500 chars)' });
  }

  try {
    const updated = await User.findOneAndUpdate(
      { seq: seqParam },
      { intro },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json({ name: updated.name, intro: updated.intro, seq: updated.seq });
  } catch (err) {
    console.error('[PUT /user/:seq] update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
