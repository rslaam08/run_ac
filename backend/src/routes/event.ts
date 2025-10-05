// backend/src/routes/event.ts
import express from 'express';
import User from '../models/User';
import MoonBet from '../models/MoonBet';
import MoonSlot from '../models/MoonSlot';
import MoonPurchase from '../models/MoonPurchase';
import { isWithinEvent, isBettingWindow, getEventSlotId } from '../utils/moon';
import { ensureJwt } from '../middleware/jwt';

const router = express.Router();

/** 마켓 고정 목록 */
const ITEMS = [
  { id: 'majjj',    name: '마이쮸(원하는맛)',         price: 1006,   img: '' },
  { id: 'banana',   name: '바나나우유',               price: 2025,   img: '' },
  { id: 'seolleim', name: '설레임',                   price: 12345,  img: '' },
  { id: 'ediya_vl', name: '이디야 바닐라라떼 L',      price: 31415,  img: '' },
  { id: 'mom_set',  name: '맘스터치 싸이버거 세트',   price: 54321,  img: '' },
  { id: 'bbq',      name: 'BBQ황금올리브+콜라1.25L',  price: 173205, img: '' },
];

/** JWT 페이로드 얻기 (ensureJwt 가 어떤 필드에 넣든 대응) */
function getJwtUser(req: express.Request): { seq: number; name?: string; isAdmin?: boolean } | null {
  const a = (req as any).jwtUser;
  const b = (req as any).auth;
  return (a && typeof a.seq === 'number') ? a
       : (b && typeof b.seq === 'number') ? b
       : null;
}

/** 1) 내 상태 (로그인 필요) */
router.get('/status', ensureJwt, async (req, res) => {
  const me = getJwtUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });

  const user = await User.findOne({ seq: me.seq }).lean();
  return res.json({
    eventOpen: isWithinEvent(),
    moon: Number(user?.moonPoints || 0),
    purchases: user?.moonPurchases || [],
    nowSlotId: getEventSlotId(new Date()),
    isBettingWindow: isBettingWindow(),
  });
});

/** 랜덤 배수 결정 함수 (기존 분포 유지) */
function pickMultiplierRandom(): number {
  const r = Math.random() * 100;
  if (r < 30) return 0;
  if (r < 55) return 0.5;
  if (r < 75) return 1;
  if (r < 90) return 1.5;
  // remaining 10%: subdivide to 2/4/8
  const r2 = (r - 90) * 10; // 0~100
  if (r2 < 60) return 2;
  if (r2 < 96) return 4;
  return 8;
}

/** 2) 베팅 — 즉시 결과 결정/정산 (per-user immediate) */
router.post('/bet', ensureJwt, async (req, res) => {
  try {
    if (!isWithinEvent()) return res.status(400).json({ error: '이벤트 기간이 아닙니다.' });
    // (옵션) isBettingWindow 체크를 제거하거나 유지. 여기선 베팅을 항상 허용하려면 주석 처리 가능.
    // if (!isBettingWindow()) return res.status(400).json({ error: '베팅 시간이 아닙니다.' });

    const me = getJwtUser(req);
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const { amount } = req.body as { amount: number };
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: '금액 오류' });
    }

    const slotId = getEventSlotId(new Date()); // 기존 slotId 사용(참조용)
    const user = await User.findOne({ seq: me.seq });
    if (!user) return res.status(404).json({ error: '유저 없음' });

    const current = Number(user.moonPoints || 0);
    if (current < amount) return res.status(400).json({ error: '보름달코인이 부족합니다.' });

    // (기존) 중복 베팅 방지: 원하면 남겨두고, per-user 즉시결과라면 중복 베팅 허용 가능
    // const already = await MoonBet.findOne({ slotId, userSeq: me.seq });
    // if (already) return res.status(400).json({ error: '해당 슬롯에 이미 베팅했습니다.' });

    // 차감
    user.moonPoints = current - amount;
    await user.save();

    // 즉시 배수 결정
    const mul = pickMultiplierRandom();
    const payout = Number(amount) * Number(mul);

    // 베팅 저장(결과 포함)
    const bet = await MoonBet.create({
      slotId,
      userSeq: me.seq,
      amount,
      multiplier: mul,
      payout,
      resolvedAt: new Date(),
    });

    // 정산: 지급 (즉시 지급)
    if (payout > 0) {
      user.moonPoints = Number(user.moonPoints || 0) + payout;
      await user.save();
    }

    // (선택) MoonSlot에 개별 결과를 기록해두고 싶으면 아래처럼 생성(중복 허용)
    // await MoonSlot.create({ slotId: `${slotId}#${bet._id}`, multiplier: mul });

    return res.json({
      ok: true,
      bet: {
        _id: bet._id,
        amount: bet.amount,
        multiplier: bet.multiplier,
        payout: bet.payout,
        resolvedAt: bet.resolvedAt,
      },
      remain: Number(user.moonPoints || 0),
    });
  } catch (e: any) {
    console.error('/event/bet error', e);
    return res.status(500).json({ error: '서버 오류' });
  }
});

/** (기존 resolve 라우트는 보존하되, 운영상 더 이상 필요 없음) */
router.post('/resolve', async (_req, res) => {
  return res.status(400).json({ error: '이제 수동/공유 슬롯 방식은 사용하지 않습니다.' });
});

/** 4) 단일 슬롯 로그 — (slotId 기준 기존) */
router.get('/logs/:slotId', async (req, res) => {
  const slotId = req.params.slotId;
  const slot = await MoonSlot.findOne({ slotId }).lean();
  const bets = await MoonBet.find({ slotId }).lean();
  return res.json({ slot, bets });
});

/** 4-2) 전체 로그 (모든 베팅 결과 — 즉시 정산 방식에서는 모든 베팅의 multiplier/payout이 이미 채워져 있음) */
router.get('/logs/all', async (_req, res) => {
  try {
    // 최신 베팅부터
    const bets = await MoonBet.find().sort({ createdAt: -1 }).lean();

    // 사용자 이름 매핑 (batch fetch)
    const userSeqs = Array.from(new Set(bets.map(b => b.userSeq).filter(Boolean)));
    const users = await User.find({ seq: { $in: userSeqs } }).lean();
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

    return res.json({ ok: true, logs });
  } catch (e:any) {
    console.error('/event/logs/all error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/** 5) 마켓 목록 (비로그인도 허용) */
router.get('/market', async (req, res) => {
  try {
    let bought = new Set<string>();
    const me = getJwtUser(req);
    if (me?.seq != null) {
      const u = await User.findOne({ seq: me.seq }).lean();
      bought = new Set((u?.moonPurchases as string[]) || []);
    }

    return res.json({
      items: ITEMS.map(it => ({ ...it, bought: bought.has(it.id) })),
    });
  } catch (e) {
    console.error('GET /event/market error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

/** 6) 구매 (종전과 동일) */
router.post('/market/buy', ensureJwt, async (req, res) => {
  if (!isWithinEvent()) return res.status(400).json({ error: '이벤트 기간이 아닙니다.' });

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
  user.moonPurchases = [...(user.moonPurchases || []), itemId];
  await user.save();

  await MoonPurchase.create({ userSeq: me.seq, itemId, price: item.price });
  res.json({ ok: true, remain: Number(user.moonPoints || 0) });
});

/** 7) (관리자 전용) 구매내역 — seq === 1 만 */
router.get('/market/purchases', ensureJwt, async (req, res) => {
  const me = getJwtUser(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  if (me.seq !== 1) return res.status(403).json({ error: 'Forbidden' });

  const list = await MoonPurchase.find().sort({ createdAt: -1 }).lean();
  res.json(list);
});

export default router;
