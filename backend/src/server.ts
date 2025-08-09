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

// 여러 프론트 오리진 허용
const DEFAULT_ORIGINS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_ORIGINS;

// 퍼블릭 API URL (정적 파일 URL 구성에 사용)
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// 업로드 디렉터리(서버/정적 서빙 공통)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

/* =========================
 * 프록시 신뢰(HTTPS 쿠키용)
 * ========================= */
app.set('trust proxy', 1);

/* =========================
 * 미들웨어
 * ========================= */
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                // 서버-서버, 모바일앱 등
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());

// 업로드 정적 서빙 (업로드와 동일 경로)
app.use('/uploads', express.static(UPLOAD_DIR));

/* =========================
 * 세션 (MongoStore + 크로스사이트 쿠키)
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
  cookie: isProd
    ? { maxAge: 24 * 60 * 60 * 1000, sameSite: 'none', secure: true }
    : { maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax',  secure: false }
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
 * 라우터
 * ========================= */
app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);

/* =========================
 * Express 5 catch-all
 * ========================= */
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PUBLIC_API_URL}`);
});
