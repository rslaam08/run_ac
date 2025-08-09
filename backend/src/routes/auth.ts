import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

// 프론트 기본 URL (깃허브 페이지 경로 포함)
const FRONTEND_BASE_URL =
  (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// JWT 시크릿
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  console.warn('[Auth] WARNING: JWT_SECRET is not set.');
}

// 성공 리다이렉트 URL 생성 헬퍼
function front(urlPath: string) {
  // urlPath 예: '/#/auth/callback'
  return `${FRONTEND_BASE_URL}${urlPath}`;
}

// (디버그용) 현재 설정 확인
router.get('/debug', (_req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_BASE_URL,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  });
});

// 1) 구글 OAuth 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2) 구글 OAuth 콜백
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // 로그인 성공 → JWT 발급 후 프론트로 토큰 전달
    try {
      const u = req.user as any;
      if (!u) {
        return res.redirect(front('/#/auth/callback?error=NO_USER'));
      }

      const token = jwt.sign(
        {
          seq: u.seq,
          name: u.name,
          isAdmin: !!u.isAdmin,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 깃허브 페이지 해시 라우팅으로 콜백
      const redirectUrl = front(`/#/auth/callback?token=${encodeURIComponent(token)}`);
      return res.redirect(redirectUrl);
    } catch (e) {
      console.error('[OAuth callback error]', e);
      return res.redirect(front('/#/auth/callback?error=ISSUE_TOKEN'));
    }
  }
);

// 3) 현재 로그인 유저(토큰 기반)
router.get('/me', (req: any, res) => {
  // JWT 인증 미들웨어를 전역으로 쓰지 않는 경우,
  // 프록시 레이어에서 Authorization 헤더 검증을 이미 했다고 가정하거나
  // 여기서 직접 파싱해도 됩니다. (프로젝트에 맞춰 유지)
  if (req.user) {
    const user = req.user as any;
    return res.json({
      seq: user.seq,
      name: user.name,
      intro: user.intro,
      isAdmin: !!user.isAdmin,
    });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// 4) 로그아웃 (선택)
//   - JWT 방식에선 클라이언트가 localStorage에서 토큰을 지우면 사실상 로그아웃.
//   - 서버가 블랙리스트를 운용하지 않는다면 여기서는 OK 반환 정도로 충분.
router.post('/logout', (_req, res) => {
  return res.json({ message: 'ok' });
});

export default router;
