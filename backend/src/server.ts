import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import MongoStore from 'connect-mongo';

import authRouter from './routes/auth';
import userRouter from './routes/user';
import recordRouter from './routes/record';
import './passportConfig';

const app = express();

/* =========================
 * 환경 변수/설정
 * ========================= */
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);

// 여러 프론트 오리진 허용 (쉼표 구분)
const DEFAULT_ORIGINS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_ORIGINS;

// 퍼블릭 API URL (정적 파일 URL 구성 및 로그에 사용)
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// 업로드 디렉터리 (없으면 생성)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// (선택) 프론트엔드 빌드 폴더 경로: 설정돼 있고 실제 폴더가 있으면 정적 서빙
// 예) CRA 빌드를 backend 리포 안에 넣었다면 FRONTEND_DIR=/opt/render/project/src/frontend/build
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '../frontend-build');
const hasFrontend = fs.existsSync(FRONTEND_DIR);

// Mongo 연결 문자열
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGODB_URI(.env)가 필요합니다.');
  process.exit(1);
}

/* =========================
 * 프록시 신뢰(HTTPS 쿠키용)
 * ========================= */
app.set('trust proxy', 1);

/* =========================
 * 미들웨어
 * ========================= */
// CORS: 여러 오리진 허용 + 쿠키 전송
app.use(
  cors({
    origin(origin, cb) {
      // 서버-서버 호출 등 Origin이 없는 경우 허용
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// JSON 파서
app.use(express.json());

// 업로드 정적 서빙
app.use('/uploads', express.static(UPLOAD_DIR));

/* =========================
 * 세션 (MongoStore + 크로스사이트 쿠키)
 * ========================= */
app.use(
  session({
    name: 'smsession',
    secret: process.env.SESSION_SECRET!, // 반드시 환경변수 설정
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO,
      ttl: 60 * 60 * 24 * 7, // 7일
      autoRemove: 'native',
    }),
    cookie: isProd
      ? { maxAge: 24 * 60 * 60 * 1000, sameSite: 'none', secure: true }
      : { maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax', secure: false },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =========================
 * DB 연결
 * ========================= */
mongoose
  .connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* =========================
 * 라우터
 * ========================= */

// 헬스체크
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/records', recordRouter);

/* =========================
 * (선택) 프론트 정적 서빙
 *  - 같은 도메인에서 프론트까지 서빙하면 iOS 사파리 쿠키 문제 크게 줄어듭니다.
 *  - FRONTEND_DIR 설정 또는 기본 경로에 빌드 폴더가 있어야 동작합니다.
 * ========================= */
if (hasFrontend) {
  console.log('🟣 Serving frontend from:', FRONTEND_DIR);
  app.use(express.static(FRONTEND_DIR));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
} else {
  /* =========================
   * Express 5 catch-all (프론트 미서빙 시)
   * ========================= */
  app.use((req, res) => {
    res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
  });
}

/* =========================
 * 전역 에러 핸들러 (Multer 포함)
 * ========================= */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '이미지 용량은 50MB 이하여야 합니다.' });
    }
    return res.status(400).json({ error: `업로드 오류: ${err.message}` });
  }
  // CORS 에러 메시지 보기 좋게
  if (err && /CORS blocked/.test(String(err.message))) {
    console.error('[CORS]', err.message);
    return res.status(403).json({ error: err.message });
  }
  console.error('[Global Error]', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

/* =========================
 * 서버 시작
 * ========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PUBLIC_API_URL}`);
});
