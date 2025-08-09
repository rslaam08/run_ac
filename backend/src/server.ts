import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
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

// 여러 프론트 오리진 허용(필요 시)
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// 퍼블릭 API URL (정적 파일 URL 구성/로그 출력용)
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// 업로드 디렉터리(서버/정적 서빙 공통)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// 프론트 빌드 파일을 둘 경로
const FRONT_BUILD_DIR = path.join(__dirname, '../frontend_build');

/* =========================
 * 프록시 신뢰(HTTPS 쿠키용)
 * ========================= */
app.set('trust proxy', 1);

/* =========================
 * 미들웨어
 * ========================= */
// CORS: origin:true(요청 Origin 그대로 반영) + credentials 허용
app.use(cors({
  origin: true,            // 요청한 Origin을 그대로 반영
  credentials: true
}));

app.use(express.json());

// 업로드 정적 서빙 (업로드와 동일 경로)
app.use('/uploads', express.static(UPLOAD_DIR));

/* =========================
 * 세션 (MongoStore + 쿠키)
 * ========================= */
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGODB_URI(.env)가 필요합니다.');
  process.exit(1);
}

app.use(session({
  name: 'smsession',
  secret: process.env.SESSION_SECRET!,  // Render 환경변수 필수
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO,
    ttl: 60 * 60 * 24 * 7,
    autoRemove: 'native'
  }),
  // 이제 같은 도메인에서 프론트를 서빙하므로 SameSite=Lax 로도 안정적 동작
  cookie: isProd
    ? { maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax', secure: true }
    : { maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax', secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

/* =========================
 * DB 연결
 * ========================= */
mongoose.connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

/* =========================
 * API 라우터
 * ========================= */
app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);

/* =========================
 * 프론트 정적 서빙 + SPA 캐치올
 * ========================= */
// 프론트 빌드 정적 서빙
app.use(express.static(FRONT_BUILD_DIR));

// API/업로드/인증이 아닌 모든 경로는 SPA 엔트리로
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/auth/') ||
    req.path.startsWith('/uploads/')
  ) {
    return next();
  }
  res.sendFile(path.join(FRONT_BUILD_DIR, 'index.html'));
});

/* =========================
 * 전역 에러 핸들러 (Multer 포함)
 * ========================= */
app.use((
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '이미지 용량은 50MB 이하여야 합니다.' });
    }
    return res.status(400).json({ error: `업로드 오류: ${err.message}` });
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
