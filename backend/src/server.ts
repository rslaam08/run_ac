// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import session from 'express-session';
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

// ===== 기본 설정/경로
const DEFAULT_ORIGINS = ['https://rslaam08.github.io', 'http://localhost:3000'];
const RAW_CLIENTS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...RAW_CLIENTS, ...DEFAULT_ORIGINS])]
  .map(o => o.replace(/\/$/, '')); // trailing slash 제거

const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGODB_URI(.env)가 필요합니다.');
  process.exit(1);
}

// 프록시 뒤 secure 쿠키 허용
app.set('trust proxy', 1);

// ===================== CORS (동적 헤더 허용, 와일드카드 라우트 없음) =====================
function isAllowedOrigin(origin?: string) {
  if (!origin) return false;
  const norm = origin.replace(/\/$/, '');
  return ALLOWED_ORIGINS.includes(norm) || ALLOWED_ORIGINS.some(o => norm.startsWith(o));
}

app.use((req, res, next) => {
  const origin = (req.headers.origin as string | undefined) || '';
  const allowed = isAllowedOrigin(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  // 메서드 허용
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  // 프리플라이트가 요구한 헤더를 그대로 허용(안 오면 fallback)
  const reqACRH = (req.headers['access-control-request-headers'] as string | undefined);
  const fallbackAllowHeaders = 'Authorization, Content-Type, Cache-Control, Pragma, Accept, X-Requested-With';
  res.setHeader('Access-Control-Allow-Headers', reqACRH ?? fallbackAllowHeaders);

  // 노출 헤더(필요 시)
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type');

  // JWT는 Authorization 헤더만 사용 → 쿠키 공유 불필요
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // 캐시 금지(304/프록시 혼선 방지)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 프리플라이트 종료 (Express 5에서 와일드카드 라우트 사용 금지)
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ===================== 기본 미들웨어 =====================
app.set('etag', false);
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(session({
  name: 'smsession',
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO,
    ttl: 60 * 60 * 24 * 7,
    autoRemove: 'native',
  }),
  cookie: isProd
    ? { maxAge: 24 * 60 * 60 * 1000, sameSite: 'none', secure: true }
    : { maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax',  secure: false },
}));

app.use(passport.initialize());
app.use(passport.session());

// ===================== DB =====================
mongoose.connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ===================== 라우터 (CORS/세션/패스포트 이후) =====================
app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);
app.use('/api/event',   eventRouter);

// ===================== 헬스체크 =====================
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sshsrun-api',
    time: new Date().toISOString(),
    publicApi: PUBLIC_API_URL,
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

// ===================== 404 & 에러 핸들러 =====================
// ⚠ Express 5에서는 catch-all에 문자열 경로('*' 등) 쓰지 말 것
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

// ===================== START =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PUBLIC_API_URL}`);
});
