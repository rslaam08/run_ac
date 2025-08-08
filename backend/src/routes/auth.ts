// backend/src/routes/auth.ts

import express from 'express';
import passport from 'passport';

const router = express.Router();

// 1. 구글 OAuth 로그인 시작
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. 구글 OAuth 콜백
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (_req, res) => {
    // 로그인 후 프론트엔드로 리다이렉트
    res.redirect('http://localhost:3000');
  }
);

// 3. 현재 로그인된 유저 정보 반환
router.get('/me', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as any;
    res.json({
      seq:   user.seq,
      name:  user.name,
      intro: user.intro,
      isAdmin: user.isAdmin
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// 4. 로그아웃
router.post('/logout', (req, res, next) => {
  // Passport ≥0.6: logout이 콜백 기반으로 변경
  req.logout(err => {
    if (err) { return next(err); }

    // 세션 파괴
    req.session?.destroy(sessionErr => {
      if (sessionErr) {
        console.error('Session destroy error:', sessionErr);
        // 그래도 세션 쿠키만 클리어
        res.clearCookie('smsession');
        return res.status(500).json({ error: 'Logout failed' });
      }

      // 세션 쿠키 삭제
      res.clearCookie('smsession', {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
      });

      res.json({ message: 'Logged out' });
    });
  });
});

export default router;
