import express from 'express';
import User from '../models/User';
import MoonBet from '../models/MoonBet';
import MoonPurchase from '../models/MoonPurchase';
import { ensureJwt } from '../middleware/jwt';

const router = express.Router();

/** JWT 유저 추출 */
function getJwtUser(
  req: express.Request
): { seq: number; name?: string; isAdmin?: boolean } | null {
  const a = (req as any).jwtUser;
  const b = (req as any).auth;
  return (a && typeof a.seq === 'number')
    ? a
    : (b && typeof b.seq === 'number')
    ? b
    : null;
}

/** 배수 분포 함수 (랜덤 도박 결과) */
function pickMultiplierRandom(): number {
  const r = Math.random() * 100;

  if (r < 9) return 0;           // 9%
  if (r < 16) return 0.25;       // 7%
  if (r < 26) return 0.5;        // 10%
  if (r < 38) return 0.75;       // 12%
  if (r < 56) return 1;          // 18%
  if (r < 70) return 1.25;       // 14%
  if (r < 82) return 1.5;        // 12%
  if (r < 92) return 2;          // 10%
  if (r < 98) return 4;          // 6%
  return 8;                      // 2%
}

/** 즉시 베팅용 slotId 생성: im-YYYYMMDD-HH-MM-SS-sss-userSeq */
function makeImmediateSlotId(userSeq: number, d = new Date()) {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const H = pad(d.getHours());
  const M = pad(d.getMinutes());
  const S = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `im-${y}${m}${dd}-${H}-${M}-${S}-${ms}-${userSeq}`;
}

/** 보름달 마켓 상품 목록 (이미지 경로는 필요에 맞게 조정) */
const ITEMS = [
  { id: 'majjj',    name: '마이쮸(원하는맛)',         price: 1006,   img: '/uploads/majjj.png' },
  { id: 'banana',   name: '바나나우유',               price: 2025,   img: '/uploads/banana.png' },
  { id: 'seolleim', name: '설레임',                   price: 12345,  img: '/uploads/seolleim.png' },
  { id: 'ediya_vl', name: '이디야 바닐라라떼 L',      price: 31415,  img: '/uploads/ediya.png' },
  { id: 'mom_set',  name: '맘스터치 싸이버거 세트',   price: 54321,  img: '/uploads/mom.png' },
  { id: 'bbq',      name: 'BBQ황금올리브+콜라1.25L',  price: 173205, img: '/uploads/bbq.png' },
];

/** 1) 내 상태 */
router.get('/status', ensureJwt, async (req, res) => {
  const me = getJwtUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  const user = await User.findOne({ seq: me.seq }).lean();
  return res.json({
    eventOpen: true,
    moon: Number(user?.moonPoints || 0),
    purchases: user?.moonPurchases || [],
  });
});

/** 2) 즉시 결과형 베팅 로직 */
async function betAndResolveImmediate(userSeq: number, amount: number) {
  const user = await User.findOne({ seq: userSeq });
  if (!user) throw Object.assign(new Error('유저 없음'), { status: 404 });

  const current = Number(user.moonPoints || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('금액 오류'), { status: 400 });
  }
  if (current < amount) {
    throw Object.assign(new Error('보름달코인이 부족합니다.'), { status: 400 });
  }

  // 1) 차감
  user.moonPoints = current - amount;
  await user.save();

  // 2) 즉시 결과(배수) 결정
  const mul = pickMultiplierRandom();
  const payout = Math.round(amount * mul);

  // 3) 정산: 즉시 지급
  if (payout > 0) {
    user.moonPoints = Number(user.moonPoints || 0) + payout;
    await user.save();
  }

  // 4) slotId 생성(필수) + 기록 저장
  const slotId = makeImmediateSlotId(userSeq, new Date());
  const bet = await MoonBet.create({
    slotId,
    userSeq,
    amount,
    multiplier: mul,
    payout,
    resolvedAt: new Date(),
  });

  return {
    ok: true,
    bet: {
      _id: bet._id,
      slotId,
      amount,
      multiplier: mul,
      payout,
      resolvedAt: bet.resolvedAt,
    },
    remain: Number(user.moonPoints || 0),
  };
}

/** 3) POST /api/event/bet (정식 엔드포인트) */
router.post('/bet', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const { amount } = req.body as { amount: number };
    const result = await betAndResolveImmediate(me.seq, Number(amount));
    res.json(result);
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e?.message || '서버 오류' });
  }
});

/** 4) GET /api/event/bet?amount=1000 (테스트 편의용) */
router.get('/bet', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const amount = Number(req.query.amount);
    const result = await betAndResolveImmediate(me.seq, amount);
    res.json(result);
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e?.message || '서버 오류' });
  }
});

/** 5) 전체 로그 (모든 베팅 결과 + 닉네임) */
router.get('/logs/all', async (_req, res) => {
  try {
    const bets = await MoonBet.find().sort({ createdAt: -1 }).lean();

    const seqs = Array.from(new Set(bets.map(b => b.userSeq).filter(Boolean)));
    const users = await User.find({ seq: { $in: seqs } }).lean();
    const nameMap = new Map<number, string>();
    for (const u of users) {
      nameMap.set(u.seq, u.name || `user#${u.seq}`);
    }

    const logs = bets.map(b => ({
      _id: b._id,
      slotId: b.slotId,
      userSeq: b.userSeq,
      userName: nameMap.get(b.userSeq) || `user#${b.userSeq}`,
      amount: b.amount,
      multiplier: b.multiplier ?? 0,
      payout: b.payout ?? 0,
      createdAt: b.createdAt,
      resolvedAt: b.resolvedAt || b.createdAt,
    }));

    res.json({ ok: true, logs });
  } catch (e: any) {
    console.error('/event/logs/all error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/** 6) 마켓 목록 (비로그인 가능) */
router.get('/market', async (req, res) => {
  try {
    let bought = new Set<string>();
    const me = getJwtUser(req);
    if (me?.seq != null) {
      const u = await User.findOne({ seq: me.seq }).lean();
      bought = new Set((u?.moonPurchases as string[]) || []);
    }
    res.json({
      items: ITEMS.map(it => ({ ...it, bought: bought.has(it.id) })),
    });
  } catch (e) {
    console.error('GET /event/market error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/** 7) 마켓 구매 */
router.post('/market/buy', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const { itemId } = req.body as { itemId: string };
    const item = ITEMS.find(i => i.id === itemId);
    if (!item) return res.status(400).json({ error: '상품 없음' });

    const user = await User.findOne({ seq: me.seq });
    if (!user) return res.status(404).json({ error: '유저 없음' });

    if ((user.moonPurchases || []).includes(itemId))
      return res.status(400).json({ error: '이미 구매한 상품입니다.' });

    if (Number(user.moonPoints || 0) < item.price)
      return res.status(400).json({ error: '보름달코인이 부족합니다.' });

    user.moonPoints = Number(user.moonPoints || 0) - item.price;
    user.moonPurchases = [ ...(user.moonPurchases || []), itemId ];
    await user.save();

    await MoonPurchase.create({ userSeq: me.seq, itemId, price: item.price });
    res.json({ ok: true, remain: Number(user.moonPoints || 0) });
  } catch (e: any) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
