// backend/src/routes/record.ts
import path from 'path';
import fs from 'fs';
import express from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import Record from '../models/Record';

const router = express.Router();

/** 로그인 필요 미들웨어 */
function ensureAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  // passport가 붙이는 isAuthenticated가 없을 수도 있으니 안전하게 체크
  const ok = (req as any).isAuthenticated?.() ?? false;
  if (ok) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

/** 업로드 디렉터리 준비 */
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/** Multer 설정 (이미지 전용 / 50MB 제한) */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
  },
});

/** HH:MM:SS → 초 */
function parseHMSToSec(hms: string): number {
  const parts = (hms || '').split(':').map(v => parseInt(v, 10));
  if (parts.some(isNaN)) return NaN;
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s;
}

/** 업로드된 파일 삭제 (검증 실패 시) */
function safeUnlink(absPath?: string | null) {
  if (!absPath) return;
  fs.promises.unlink(absPath).catch(() => {});
}

/** 새 기록 업로드 (승인 대기) — POST /api/records
 *  body: time(HH:MM:SS), distance(km), date(YYYY-MM-DD), image(file)
 */
router.post('/', ensureAuth, upload.single('image'), async (req, res) => {
  const absFilePath = req.file?.path;

  try {
    const me = req.user as any;
    const userSeq: number = me?.seq;

    const { time, distance, date } = req.body as {
      time: string;
      distance: string;
      date: string;
    };

    // 시간 파싱
    const timeSec = parseHMSToSec(time);
    if (!Number.isFinite(timeSec)) {
      safeUnlink(absFilePath);
      return res.status(400).json({ error: '시간 형식이 올바르지 않습니다. (HH:MM:SS)' });
    }

    // 거리 파싱(km)
    const dist = parseFloat(distance);
    if (!Number.isFinite(dist)) {
      safeUnlink(absFilePath);
      return res.status(400).json({ error: '거리 형식이 올바르지 않습니다. (숫자 km)' });
    }

    // 검증 1) 거리 0.5~10km
    if (dist < 0.5 || dist > 10) {
      safeUnlink(absFilePath);
      return res.status(400).json({ error: '거리는 0.5km 이상 10km 이하만 업로드할 수 있습니다.' });
    }

    // 검증 2) 페이스 3:00~7:00 (초/1km)
    const paceSecPerKm = timeSec / dist;
    if (paceSecPerKm < 180 || paceSecPerKm > 420) {
      safeUnlink(absFilePath);
      return res.status(400).json({ error: '페이스는 1km 당 3:00 ~ 7:00 범위만 업로드할 수 있습니다.' });
    }

    // 검증 3) 이미지 필수
    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    }

    // 날짜 검증
    const dateObj = new Date(date);
    if (!date || isNaN(dateObj.getTime())) {
      safeUnlink(absFilePath);
      return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다.' });
    }

    // 절대 URL 생성
    // - Render에선 PUBLIC_API_URL을 반드시 넣어두는 걸 추천
    // - 없으면 현재 요청의 host를 사용 (proxy trust 설정 가정)
    const base = (
      process.env.PUBLIC_API_URL ||
      `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, ''); // 끝 슬래시 제거

    const filename = req.file.filename; // 확실한 파일명
    const imageUrl = `${base}/uploads/${filename}`;

    // 저장 (승인 대기)
    const saved = await Record.create({
      userSeq,
      timeSec,
      distance: dist,
      date: dateObj,
      imageUrl,
      status: 'pending',
    });

    return res.json(saved);
  } catch (err: any) {
    if (err instanceof multer.MulterError) {
      safeUnlink(absFilePath);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '이미지 용량은 50MB 이하여야 합니다.' });
      }
      return res.status(400).json({ error: `업로드 오류: ${err.message}` });
    }
    console.error('[POST /api/records] error:', err);
    safeUnlink(absFilePath);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/** 특정 유저의 승인된 기록 — GET /api/records/user/:seq */
router.get('/user/:seq', async (req, res) => {
  const seq = Number(req.params.seq);
  if (!Number.isFinite(seq)) return res.status(400).json({ error: '잘못된 seq' });

  const list = await Record.find({ userSeq: seq, status: 'approved' })
    .sort({ date: -1, _id: -1 });
  res.json(list);
});

/** (관리자) 승인 대기 목록 — GET /api/records/pending */
router.get('/pending', ensureAuth, async (req, res) => {
  const me = req.user as any;
  if (!me?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const list = await Record.find({ status: 'pending' })
    .sort({ date: -1, _id: -1 });
  res.json(list);
});

/** (관리자) 승인 — PUT /api/records/:id/approve */
router.put('/:id/approve', ensureAuth, async (req, res) => {
  const me = req.user as any;
  if (!me?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const id = req.params.id;
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: '잘못된 id' });

  const updated = await Record.findByIdAndUpdate(id, { status: 'approved' }, { new: true });
  res.json(updated);
});

/** (관리자) 거절 — PUT /api/records/:id/reject */
router.put('/:id/reject', ensureAuth, async (req, res) => {
  const me = req.user as any;
  if (!me?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const id = req.params.id;
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: '잘못된 id' });

  const updated = await Record.findByIdAndUpdate(id, { status: 'rejected' }, { new: true });
  res.json(updated);
});

export default router;
