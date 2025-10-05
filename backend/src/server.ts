// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import session from 'express-session';
import cors, { CorsOptions } from 'cors';
import path from 'path';
import multer from 'multer';
import MongoStore from 'connect-mongo';

import authRouter from './routes/auth';
import userRouter from './routes/user';
import recordRouter from './routes/record';
import eventRouter from './routes/event';
import './passportConfig';

const app = express();

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);

// ✅ 허용 Origin 목록 구성
const DEFAULT_ORIGINS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_ORIGINS;

const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGODB_URI(.env)가 필요합니다.');
  process.exit(1);
}

// ✅ 프록시 뒤에서 secure 쿠키를 쓰려면 필수
app.set('trust proxy', 1);

// ============================= CORS & 기본 미들웨어 순서 =============================
// ✅ CORS: *반드시* 라우터보다 먼저
const corsOptions: CorsOptions = {
  // 절대 에러를 던지지 말 것! (cb(new Error(...)) 금지)
  origin(origin, cb) {
    // same-origin 요청(Origin 헤더 없음)은 허용
    if (!origin) return cb(null, true);

    const norm = origin.replace(/\/$/, '');
    const okSet = new Set(ALLOWED_ORIGINS.map(o => o.replace(/\/$/, '')));

    // 허용: true / 비허용: false 로 “조용히” 넘김
    cb(null, okSet.has(norm));
  },
  credentials: true, // axios withCredentials 대응
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // 'authorization' 소문자로 와도 OK(대소문자 무시)
  exposedHeaders: ['Content-Type'],
  maxAge: 86400,
  optionsSuccessStatus: 204, // 프리플라이트 상태코드 고정
};

app.use(cors(corsOptions));
// ❌ (원인) app.options('*', ...)  →  Express 5에서 별표 경로가 invalid
// ✅ 아예 필요 없음. cors 미들웨어가 프리플라이트 응답(204)을 자동 처리함.

// JSON 파서 (CORS 뒤, 라우터 앞)
app.use(express.json());

// 정적 업로드 경로
app.use('/uploads', express.static(UPLOAD_DIR));

// ============================= 세션 & 패스포트 =============================
app.use(session({
  name: 'smsession',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO,
    ttl: 60 * 60 * 24 * 7,
    autoRemove: 'native'
  }),
  cookie: isProd
    ? { maxAge: 24*60*60*1000, sameSite: 'none', secure: true }
    : { maxAge: 24*60*60*1000, sameSite: 'lax',  secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

// ============================= DB 연결 =============================
mongoose.connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================= 라우터 등록 =============================
app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);
app.use('/api/event',   eventRouter);

// 헬스체크
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sshsrun-api',
    time: new Date().toISOString(),
    publicApi: PUBLIC_API_URL,
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

// ============================= 404 & 에러 핸들러 =============================
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

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

// ============================= START =============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PUBLIC_API_URL}`);
});
