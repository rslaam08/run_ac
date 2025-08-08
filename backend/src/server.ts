import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import multer from 'multer';

import authRouter from './routes/auth';
import userRouter from './routes/user';
import recordRouter from './routes/record';
import './passportConfig';

const app = express();

// ======== 환경/설정 값 ========
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);

// CORS 허용 Origin (배포: GitHub Pages 도메인, 로컬: http://localhost:3000)
const CLIENT_URL =
  process.env.CLIENT_URL // 예: https://rslaam.github.io
  || 'http://localhost:3000';

// ======== 미들웨어 ========
app.use(cors({
  origin: CLIENT_URL,     // ⚠️ Origin에는 경로(/run_ac) 넣지 말고 'https://도메인'만!
  credentials: true
}));

app.use(express.json());

// 업로드된 이미지 static 서빙
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 세션 (배포는 크로스사이트 쿠키 설정)
app.use(session({
  name: 'smsession',
  secret: process.env.SESSION_SECRET || 'CHANGE_ME',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
    secure:   isProd ? true   : false
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ======== DB 연결 ========
// 환경변수 이름 혼용 대비: MONGODB_URI 우선, 없으면 MONGO_URI 사용
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGODB_URI(.env)가 필요합니다.');
  process.exit(1);
}
mongoose.connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ======== 라우터 ========
app.use('/auth',        authRouter);
app.use('/api/user',    userRouter);
app.use('/api/records', recordRouter);

// ======== Express 5 안전한 catch-all ========
// 경로 문자열( '*', '/*', '/:splat(*)' 등 )을 쓰지 말고, 핸들러만 등록합니다.
app.use((req, res) => {
  // SPA를 같이 서빙한다면 여기서 index.html 리턴하도록 바꿀 수 있습니다.
  // res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

/** 전역 에러 핸들러 (Multer 포함) */
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
