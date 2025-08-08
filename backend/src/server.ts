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

// 허용할 프론트엔드 오리진 목록
// - 쉼표(,)로 여러 개 지정 가능: CLIENT_URLS="https://rslaam08.github.io, http://localhost:3000"
// - 아무것도 없으면 로컬/깃허브 기본값 사용
const DEFAULT_ORIGINS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_ORIGINS;

// 퍼블릭 API URL(이미지 URL 만들 때 사용)
// 예: https://sshsrun-api.onrender.com
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || `http://localhost:${PORT}`;

// Mongo 연결 문자열 (MONGODB_URI 우선)
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
app.use(cors({
  origin(origin, cb) {
    // 모바일 앱/서버 간 통신 등 origin이 없는 경우 허용
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

// JSON 파서
app.use(express.json());

// 업로드된 이미지 static 서빙 (로컬 디스크 사용 시)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 세션 (프로덕션: MongoStore 사용 + 크로스사이트 쿠키 세팅)
app.use(session({
  name: 'smsession',
  secret: process.env.SESSION_SECRET!,  // 반드시 Render 환경변수에 설정
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO,
    ttl: 60 * 60 * 24 * 7,  // 7일
    autoRemove: 'native'
  }),
  cookie: isProd
    ? {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'none',  // GitHub Pages(다른 도메인)에서 쿠키 필요
        secure: true       // HTTPS 필수(Render는 HTTPS)
      }
    : {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',   // 로컬 개발에선 Lax/secure=false
        secure: false
      }
}));

// Passport
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
 *  - 문자열 패턴 쓰지 말고 핸들러만 등록
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

/* =========================
 * 서버 시작
 * ========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PUBLIC_API_URL.replace(/\/$/, '')}`);
});
