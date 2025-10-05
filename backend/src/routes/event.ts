import express from 'express';
import User from '../models/User';
import MoonBet from '../models/MoonBet';
import MoonPurchase from '../models/MoonPurchase';
import { ensureJwt } from '../middleware/jwt';

// ⚙️ 즉시결과형: 슬롯, 이벤트 시간 로직은 단순화
const router = express.Router();

/** JWT 유저 추출 */
function getJwtUser(req: express.Request): { seq: number; name?: string; isAdmin?: boolean } | null {
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
  if (r < 30) return 0;
  if (r < 55) return 0.5;
  if (r < 75) return 1;
  if (r < 90) return 1.5;
  const r2 = (r - 90) * 10; // 0~100
  if (r2 < 60) return 2;
  if (r2 < 96) return 4;
  return 8;
}

/** 보름달 마켓 상품 목록 */
const ITEMS = [
  { id: 'majjj', name: '마이쮸(원하는맛)', price: 1006, img: '/uploads/majjj.png' },
  { id: 'banana', name: '바나나우유', price: 2025, img: '/uploads/banana.png' },
  { id: 'seolleim', name: '설레임', price: 12345, img: '/uploads/seolleim.png' },
  { id: 'ediya_vl', name: '이디야 바닐라라떼 L', price: 31415, img: '/uploads/ediya.png' },
  { id: 'mom_set', name: '맘스터치 싸이버거 세트', price: 54321, img: '/uploads/mom.png' },
  { id: 'bbq', name: 'BBQ황금올리브+콜라1.25L', price: 173205, img: '/uploads/bbq.png' },
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
  if (!Number.isFinite(amount) || amount <= 0)
    throw Object.assign(new Error('금액 오류'), { status: 400 });
  if (current < amount)
    throw Object.assign(new Error('보름달코인이 부족합니다.'), { status: 400 });

  // 차감
  user.moonPoints = current - amount;
  await user.save();

  // 결과 생성
  const mul = pickMultiplierRandom();
  const payout = Math.round(amount * mul);
  user.moonPoints += payout;
  await user.save();

  // 기록 저장
  const bet = await MoonBet.create({
    userSeq,
    amount,
    multiplier: mul,
    payout,
    resolvedAt: new Date(),
  });

  return {
    ok: true,
    bet: {
      amount,
      multiplier: mul,
      payout,
    },
    remain: user.moonPoints,
  };
}

/** 3) POST /api/event/bet (정상 경로) */
router.post('/bet', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    const { amount } = req.body as { amount: number };
    const result = await betAndResolveImmediate(me.seq, Number(amount));
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || '서버 오류' });
  }
});

/** 4) GET /api/event/bet?amount=1000 (테스트용 GET 지원) */
router.get('/bet', ensureJwt, async (req, res) => {
  try {
    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });
    const amount = Number(req.query.amount);
    const result = await betAndResolveImmediate(me.seq, amount);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message || '서버 오류' });
  }
});

/** 5) 전체 로그 */
router.get('/logs/all', async (_req, res) => {
  const bets = await MoonBet.find().sort({ createdAt: -1 }).lean();
  const enriched = await Promise.all(
    bets.map(async (b) => {
      const u = await User.findOne({ seq: b.userSeq }).lean();
      return {
        userSeq: b.userSeq,
        name: u?.name ?? `#${b.userSeq}`,
        amount: b.amount,
        multiplier: b.multiplier,
        payout: b.payout,
        resolvedAt: b.resolvedAt,
      };
    })
  );
  res.json({ ok: true, bets: enriched });
});

/** 6) 마켓 목록 */
router.get('/market', async (req, res) => {
  const me = getJwtUser(req);
  let bought = new Set<string>();
  if (me?.seq) {
    const u = await User.findOne({ seq: me.seq }).lean();
    bought = new Set(u?.moonPurchases || []);
  }
  res.json({ items: ITEMS.map(i => ({ ...i, bought: bought.has(i.id) })) });
});

/** 7) 마켓 구매 */
router.post('/market/buy', ensureJwt, async (req, res) => {
  const me = getJwtUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  const { itemId } = req.body as { itemId: string };
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: '상품 없음' });

  const user = await User.findOne({ seq: me.seq });
  if (!user) return res.status(404).json({ error: '유저 없음' });
  if (user.moonPoints < item.price)
    return res.status(400).json({ error: '보름달코인 부족' });
  if ((user.moonPurchases || []).includes(itemId))
    return res.status(400).json({ error: '이미 구매한 상품' });

  user.moonPoints -= item.price;
  user.moonPurchases = [...(user.moonPurchases || []), itemId];
  await user.save();

  await MoonPurchase.create({ userSeq: me.seq, itemId, price: item.price });
  res.json({ ok: true, remain: user.moonPoints });
});

export default router;
