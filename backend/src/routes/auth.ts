// backend/src/routes/auth.ts
import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '___FILL_ME_CHANGE_ME___';

/** 프론트 도메인: CLIENT_URLS="https://rslaam08.github.io,http://localhost:3000" */
const DEFAULT_CLIENTS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const CLIENTS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_CLIENTS;

function pickFrontendHome() {
  const primary = CLIENTS[0] || 'http://localhost:3000';
  // 깃헙 페이지는 서브패스(/run_ac/)가 있을 수 있음
  // 필요시 환경변수 FRONTEND_PATH=/run_ac/ 로 별도 지정 가능
  const FRONTEND_PATH = process.env.FRONTEND_PATH || '/run_ac/';
  if (isProd && primary.includes('github.io')) {
    return `${primary.replace(/\/$/, '')}${FRONTEND_PATH}`;
  }
  return primary; // 로컬
}

// ====== 디버그 ======
router.get('/debug', (req, res) => {
  res.json({
    CLIENTS,
    redirectTarget: pickFrontendHome(),
    NODE_ENV: process.env.NODE_ENV,
    hasSession: !!(req as any).isAuthenticated?.() && !!req.user,
  });
});

// 1) 구글 OAuth 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2) 구글 OAuth 콜백 → JWT 발급 → 프론트로 리다이렉트(#token=...)
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      // 1) JWT 발급 (이미 구현돼 있다면 기존 코드 사용)
      const me = req.user as any;
      const payload = { seq: me.seq, name: me.name, isAdmin: !!me.isAdmin };
      const token = require('jsonwebtoken').sign(
        payload,
        process.env.JWT_SECRET!,         // 반드시 설정되어 있어야 함
        { expiresIn: '7d' }
      );

      // 2) 보내줄 프론트 주소 결정
      // 우선순위: ?origin= → 환경변수 CLIENT_URLS[0] → 기본값
      const DEFAULT_FRONT = 'https://rslaam08.github.io/run_ac/';
      const envFront =
        (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)[0];
      const queryFront = typeof req.query.origin === 'string' ? req.query.origin : null;

      // 최종 기본 프론트
      let frontBase = (queryFront || envFront || DEFAULT_FRONT).replace(/\/+$/, '') + '/';

      // 3) HashRouter 기준의 콜백 경로로 리다이렉트
      //    ex) https://.../run_ac/#/auth/callback?token=xxxx
      const redirectUrl = `${frontBase}#/auth/callback?token=${encodeURIComponent(token)}`;

      console.log('[OAuth] redirect →', redirectUrl.substring(0, 120) + '...');
      return res.redirect(302, redirectUrl);
    } catch (e) {
      console.error('[OAuth] callback error:', e);
      return res.redirect(302, '/');
    }
  }
);


// 3) 현재 로그인된 유저 (세션 OR JWT 둘 다 지원)
router.get('/me', async (req, res) => {
  // (A) 세션 로그인?
  if ((req as any).isAuthenticated?.() && req.user) {
    const u = req.user as any;
    return res.json({ seq: u.seq, name: u.name, intro: u.intro, isAdmin: u.isAdmin, via: 'session' });
  }

  // (B) JWT?
  try {
    const auth = req.get('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'No auth' });

    const payload = jwt.verify(m[1], JWT_SECRET) as any;
    const u = await User.findOne({ seq: payload.seq }).lean();
    if (!u) return res.status(401).json({ error: 'User not found' });

    return res.json({ seq: u.seq, name: u.name, intro: u.intro, isAdmin: u.isAdmin, via: 'jwt' });
  } catch (e: any) {
    console.warn('[auth] /me jwt verify failed', e?.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// 4) 로그아웃(세션 정리; JWT는 클라이언트가 버리면 끝)
router.post('/logout', (req, res, next) => {
  (req as any).logout?.((err: any) => {
    if (err) return next(err);

    req.session?.destroy((sessionErr) => {
      const cookieOptions = isProd
        ? { path: '/', httpOnly: true, sameSite: 'none' as const, secure: true }
        : { path: '/', httpOnly: true, sameSite: 'lax'  as const, secure: false };

      res.clearCookie('smsession', cookieOptions);
      if (sessionErr) return res.status(500).json({ error: 'Logout failed' });
      return res.json({ message: 'Logged out' });
    });
  });
});

export default router;
