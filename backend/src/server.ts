import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import session from 'express-session';
import cors, { CorsOptionsDelegate } from 'cors';
import path from 'path';
import multer from 'multer';
import MongoStore from 'connect-mongo';

import authRouter from './routes/auth';
import userRouter from './routes/user';
import recordRouter from './routes/record';
import eventRouter from './routes/event';
import './passportConfig';

// 🚨 자동 정산에 필요한 것들
import MoonSlot from './models/MoonSlot';
import MoonBet from './models/MoonBet';
import User from './models/User';
import { getEventSlotId, isWithinEvent } from './utils/moon';

const app = express();

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);

// 허용 Origin
const DEFAULT_ORIGINS = ['http://localhost:3000', 'https://rslaam08.github.io'];
const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = CLIENT_URLS.length ? CLIENT_URLS : DEFAULT_ORIGINS;

const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGODB_URI(.env)가 필요합니다.');
  process.exit(1);
}

app.set('trust proxy', 1);

// CORS (라우터보다 먼저)
const corsOptions: CorsOptionsDelegate = (req, cb) => {
  const origin = req.headers['origin'] as string | undefined;
  if (!origin) return cb(null, { origin: true, credentials: true });

  const norm = origin.replace(/\/$/, '');
  const ok = new Set([...ALLOWED_ORIGINS.map(o => o.replace(/\/$/, ''))]);
  if (ok.has(norm)) {
    cb(null, {
      origin: true,
      credentials: true,
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      allowedHeaders: ['Content-Type','Authorization'],
      exposedHeaders: ['Content-Type'],
      maxAge: 86400,
    });
  } else {
    cb(new Error(`CORS blocked for origin: ${origin}`));
  }
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 캐시 비활성(ETag 끔)
app.set('etag', false);

app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

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

mongoose.connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);
app.use('/api/event',   eventRouter);

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sshsrun-api',
    time: new Date().toISOString(),
    publicApi: PUBLIC_API_URL,
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// 전역 에러 핸들러
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


// ============= 🕓 자동 정산 스케줄러 (매 10분 정각) =============
async function autoResolveCurrentSlot() {
  if (!isWithinEvent()) return;

  const slotId = getEventSlotId(new Date());
  const exists = await MoonSlot.findOne({ slotId });
  if (exists) return; // 이미 확정됨

  // 확률 분포에 따라 multiplier
  const r = Math.random() * 100;
  let mul = 0;
  if (r < 30) mul = 0;
  else if (r < 55) mul = 0.5;
  else if (r < 75) mul = 1;
  else if (r < 90) mul = 1.5;
  else {
    const r2 = (r - 90) * 10;
    if (r2 < 60) mul = 2;
    else if (r2 < 96) mul = 4;
    else mul = 8;
  }

  const slot = await MoonSlot.create({ slotId, multiplier: mul });

  // 베팅 정산 + payout 저장
  const bets = await MoonBet.find({ slotId });
  for (const b of bets) {
    const u = await User.findOne({ seq: b.userSeq });
    if (!u) continue;
    const reward = Number(b.amount) * mul;
    u.moonPoints = Number(u.moonPoints || 0) + reward;
    await u.save();
    b.set('payout', reward);
    await b.save();
  }

  console.log(`[AutoResolve] ${slotId} → x${mul}, bets=${bets.length}`);
}

// 초당 체크하여 (…:00, …:10, …:20, …)에만 실행
setInterval(() => {
  const now = new Date();
  if (now.getSeconds() === 0 && now.getMinutes() % 10 === 0) {
    autoResolveCurrentSlot().catch(e => console.error('Auto resolve error', e));
  }
}, 1000);
