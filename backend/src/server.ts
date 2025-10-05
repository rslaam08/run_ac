// backend/src/server.ts (DEBUG BUILD)
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

// 프록시 뒤 secure 쿠키
app.set('trust proxy', 1);

// ===== 유틸: 토큰 마스킹 & 헤더 로그 축약 =====
function maskToken(s: any) {
  const t = typeof s === 'string' ? s : '';
  if (!t) return '';
  if (t.length <= 12) return '[MASKED]';
  return t.slice(0, 6) + '...' + t.slice(-4);
}
function pickHeaders(h: Record<string, any>) {
  return {
    origin: h['origin'],
    referer: h['referer'],
    'content-type': h['content-type'],
    authorization: h['authorization'] ? `Bearer ${maskToken(String(h['authorization']).replace(/^Bearer\s+/i,''))}` : undefined,
  };
}

// ===== CORS: 전 구간 방탄 + 로그 =====
// 디버그용 전체 허용 스위치 (원인 파악용, 끝나면 끄기!)
const FORCE_CORS_WIDE = process.env.FORCE_CORS_WIDE === '1';

function isAllowedOrigin(origin?: string) {
  if (!origin) return false;
  const norm = origin.replace(/\/$/, '');
  return FORCE_CORS_WIDE || ALLOWED_ORIGINS.includes(norm) || ALLOWED_ORIGINS.some(o => norm.startsWith(o));
}

// 요청/응답 로거 + CORS 헤더 주입
app.use((req, res, next) => {
  const origin = (req.headers.origin as string | undefined) || '';
  const allowed = isAllowedOrigin(origin);

  // 1) 요청 로그
  console.log(`[REQ] ${req.method} ${req.originalUrl} | origin=${origin || '-'} | allowed=${allowed} | headers=`, pickHeaders(req.headers as any));

  // 2) CORS 헤더(모든 응답 경로에 선반영)
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  // JWT는 Authorization 헤더만 사용 → 쿠키 공유 안 함
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // 캐시 금지(브라우저 304 혼선 방지)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 3) 프리플라이트는 여기서 종료
  if (req.method === 'OPTIONS') {
    console.log(`[RES] OPTIONS ${req.originalUrl} -> 204 (preflight)`);
    return res.sendStatus(204);
  }

  // 4) 응답 완료 로거
  const t0 = Date.now();
  res.on('finish', () => {
    console.log(`[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now()-t0}ms)`);
  });

  next();
});

// ===== 기본 미들웨어
app.set('etag', false);
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ===== 세션
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

// ===== Passport
app.use(passport.initialize());
app.use(passport.session());

// ===== DB
mongoose.connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ===== 라우터 (CORS/세션/패스포트 이후)
app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);
app.use('/api/event',   eventRouter);

// ===== 진단용 엔드포인트 (CORS/오리진/토큰/상태)
app.get('/diag/env', (_req, res) => {
  res.json({
    ok: true,
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_API_URL: PUBLIC_API_URL,
    ALLOWED_ORIGINS: ALLOWED_ORIGINS,
    FORCE_CORS_WIDE: FORCE_CORS_WIDE,
    time: new Date().toISOString(),
  });
});

app.get('/diag/cors', (req, res) => {
  res.json({
    ok: true,
    origin: req.headers.origin || null,
    note: '이 응답이 브라우저에서 CORS 오류 없이 보이면, 기본 CORS 미들웨어는 정상입니다.',
  });
});

app.get('/diag/ping', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/diag/headers', (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    url: req.originalUrl,
    headers: pickHeaders(req.headers as any),
  });
});

app.get('/diag/jwt', (req, res) => {
  const auth = String(req.headers.authorization || '');
  const m = auth.match(/^Bearer\s+(.+)$/i);
  res.json({
    ok: true,
    hasAuthHeader: !!m,
    tokenMasked: m ? maskToken(m[1]) : null,
    tip: '프론트 axios가 Authorization 헤더를 제대로 붙이고 있는지 확인하세요.',
  });
});

// ===== 헬스체크
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sshsrun-api',
    time: new Date().toISOString(),
    publicApi: PUBLIC_API_URL,
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

// ===== 404 (Express 5: 경로 없이!)
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// ===== 전역 에러 핸들러
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

// ===== START
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PUBLIC_API_URL}`);
});
