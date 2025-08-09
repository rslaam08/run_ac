// backend/src/routes/auth.ts
import express from 'express';
import passport from 'passport';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

/** 프론트의 “완성된 홈 URL”을 환경변수로 직접 받습니다.
 *  예) https://rslaam08.github.io/run_ac/
 *  없으면 깃헙 페이지 패턴을 추정해서 만들어 봅니다.
 */
function getFrontendHome(): string {
  const envHome = (process.env.FRONTEND_HOME || '').trim();
  if (envHome) return envHome.replace(/\/?$/, '/'); // 끝에 슬래시 보장

  // 백업 경로: CLIENT_URLS에서 첫 번째를 골라 github.io면 /run_ac/ 붙이기
  const raw = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '').split(',')
    .map(s => s.trim()).filter(Boolean)[0] || 'http://localhost:3000';

  if (isProd && /github\.io/i.test(raw)) {
    return `${raw.replace(/\/$/, '')}/run_ac/`;
  }
  return raw.endsWith('/') ? raw : `${raw}/`;
}

const FRONTEND_HOME = getFrontendHome();

// (선택) 디버깅용
router.get('/debug', (_req, res) => {
  res.json({
    FRONTEND_HOME,
    CLIENT_URLS: process.env.CLIENT_URLS || process.env.CLIENT_URL,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// 1) 구글 OAuth 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2) 구글 OAuth 콜백
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: FRONTEND_HOME, // 실패도 프론트로
  }),
  (_req, res) => {
    // 성공도 프론트로
    res.redirect(FRONTEND_HOME);
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
      const cookieOptions = isProd
        ? { path: '/', httpOnly: true, sameSite: 'none' as const, secure: true }
        : { path: '/', httpOnly: true, sameSite: 'lax'  as const, secure: false };

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
