import express from 'express';
import passport from 'passport';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

/** 로그인 후 리다이렉트할 홈(백엔드와 같은 도메인으로) */
function backendHome() {
  const base = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  return `${base}/`;
}

// (선택) 디버그용
router.get('/debug', (_req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    redirectTarget: backendHome()
  });
});

// 1) 구글 OAuth 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2) 구글 OAuth 콜백
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (_req, res) => {
    // 로그인 성공 후 백엔드가 서빙하는 프론트 홈으로
    res.redirect(backendHome());
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
      // 세션 쿠키 삭제 (서버 세션 설정과 동일한 sameSite/secure 로)
      const cookieOptions = isProd
        ? { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: true }
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
