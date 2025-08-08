// backend/src/routes/auth.ts
import express from 'express';
import passport from 'passport';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

/**
 * 프론트 도메인(여러 개 있을 수 있음)
 * - Render 환경변수 CLIENT_URLS="https://rslaam08.github.io,http://localhost:3000"
 * - 없으면 기본값 사용
 */
const DEFAULT_CLIENTS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const CLIENTS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_CLIENTS;

// 깃헙 페이지는 /run_ac 경로 아래에 앱이 배포됨
function pickFrontendHome() {
  const primary = CLIENTS[0] || 'http://localhost:3000';
  // 프로덕션(깃헙 페이지)일 때는 /run_ac/로 보내기
  if (isProd && primary.includes('github.io')) {
    return `${primary.replace(/\/$/, '')}/run_ac/`;
  }
  return primary; // 로컬은 http://localhost:3000
}

// (선택) 디버그용
router.get('/debug', (_req, res) => {
  res.json({
    CLIENTS,
    redirectTarget: pickFrontendHome(),
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// 1) 구글 OAuth 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2) 구글 OAuth 콜백
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (_req, res) => {
    // 로그인 성공 후 프론트로 이동
    res.redirect(pickFrontendHome());
  }
);

// 3) 현재 로그인된 유저 정보
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    const user = req.user as any;
    return res.json({
      seq: user.seq,
      name: user.name,
      intro: user.intro,
      isAdmin: user.isAdmin,
    });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// 4) 로그아웃
router.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);

    req.session?.destroy(sessionErr => {
      // 세션은 파괴하고
      const cookieOptions = isProd
        ? { path: '/', httpOnly: true, sameSite: 'none' as const, secure: true }
        : { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: false };

      res.clearCookie('smsession', cookieOptions);

      if (sessionErr) {
        console.error('Session destroy error:', sessionErr);
        return res.status(500).json({ error: 'Logout failed' });
      }
      return res.json({ message: 'Logged out' });
    });
  });
});

export default router;
