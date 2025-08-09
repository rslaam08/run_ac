import express from 'express';
import passport from 'passport';
import { signUserToken, readJwt } from '../middleware/jwt';

const router = express.Router();

// 배포 시: https://rslaam08.github.io/run_ac/
// 로컬 테스트 시: http://localhost:3000/
const FRONT_BASE =
  (process.env.FRONT_BASE as string)
  || 'http://localhost:3000/';

// 깃허브 Pages(CRA HashRouter)를 고려한 콜백 경로
function buildFrontCallbackURL(token: string) {
  // 해시 라우터 기준: #/auth/callback?token=...
  const base = FRONT_BASE.replace(/\/$/, '');
  return `${base}#/auth/callback?token=${encodeURIComponent(token)}`;
}

// 1) 구글 OAuth 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2) 구글 OAuth 콜백 (세션 없이 JWT 발급 후 프론트로 리다이렉트)
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/' }),
  (req, res) => {
    const u = req.user as any; // passport가 넣어줌
    const token = signUserToken({
      id: u.id,
      seq: u.seq,
      name: u.name,
      isAdmin: u.isAdmin,
    });
    return res.redirect(buildFrontCallbackURL(token));
  }
);

// 3) 현재 로그인 정보 (토큰 기반)
router.get('/me', (req, res) => {
  const payload = readJwt(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    seq: payload.seq,
    name: payload.name,
    isAdmin: !!payload.isAdmin,
  });
});

// 4) 로그아웃 (서버 상태 없음 → 클라이언트에서 토큰 삭제)
router.post('/logout', (_req, res) => {
  res.json({ message: 'Client should delete token' });
});

export default router;
