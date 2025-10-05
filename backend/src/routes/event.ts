import express from 'express';
import User from '../models/User';
import MoonBet from '../models/MoonBet';
import MoonSlot from '../models/MoonSlot';
import MoonPurchase from '../models/MoonPurchase';
import { isWithinEvent, isBettingWindow, getEventSlotId } from '../utils/moon';
import { ensureJwt } from '../middleware/jwt'; // 이미 쓰는 JWT 가드

const router = express.Router();

// 마켓 고정 목록
const ITEMS = [
  { id: 'majjj', name: '마이쮸(원하는맛)', price: 1006,   img: '' },
  { id: 'banana', name: '바나나우유',       price: 2025,   img: '' },
  { id: 'seolleim', name: '설레임',        price: 12345,  img: '' },
  { id: 'ediya_vl', name: '이디야 바닐라라떼 L', price: 31415, img: '' },
  { id: 'mom_set',  name: '맘스터치 싸이버거 세트', price: 54321, img: '' },
  { id: 'bbq',      name: 'BBQ황금올리브+콜라1.25L', price: 173205, img: '' },
];

// 1) 내 상태
router.get('/status', ensureJwt, async (req, res) => {
  const me = req.user as any; // { seq, name, isAdmin }
  const user = await User.findOne({ seq: me.seq }).lean();
  return res.json({
    eventOpen: isWithinEvent(),
    moon: user?.moonPoints || 0,
    purchases: user?.moonPurchases || [],
    nowSlotId: getEventSlotId(new Date()),
    isBettingWindow: isBettingWindow(),
  });
});

// 2) 베팅
router.post('/bet', ensureJwt, async (req, res) => {
  if (!isWithinEvent()) return res.status(400).json({ error: '이벤트 기간이 아닙니다.' });
  if (!isBettingWindow()) return res.status(400).json({ error: '베팅 시간이 아닙니다.' });

  const me = req.user as any;
  const { amount } = req.body as { amount: number };
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: '금액 오류' });

  const slotId = getEventSlotId(new Date());

  const user = await User.findOne({ seq: me.seq });
  if (!user) return res.status(404).json({ error: '유저 없음' });

  if ((user.moonPoints || 0) < amount) return res.status(400).json({ error: '보름달코인이 부족합니다.' });

  // 같은 슬롯에 중복 베팅 방지(원하면 허용 가능). 간단히 막음:
  const already = await MoonBet.findOne({ slotId, userSeq: me.seq });
  if (already) return res.status(400).json({ error: '해당 슬롯에 이미 베팅했습니다.' });

  // 베팅 → 즉시 차감
  user.moonPoints = (user.moonPoints || 0) - amount;
  await user.save();

  await MoonBet.create({ slotId, userSeq: me.seq, amount });
  return res.json({ ok: true, slotId, remain: user.moonPoints });
});

// 3) 결과 산출/확정 (결과시각에 최초 호출하는 누구나 트리거 가능하도록 구현)
router.post('/resolve', async (req, res) => {
  if (!isWithinEvent()) return res.status(400).json({ error: '이벤트 기간이 아닙니다.' });

  const slotId = getEventSlotId(new Date());
  const exists = await MoonSlot.findOne({ slotId });
  if (exists) return res.json(exists); // 이미 확정됨

  // 확률 분포에 따라 multiplier 추출
  const r = Math.random() * 100;
  let mul = 0;
  if (r < 30) mul = 0;
  else if (r < 55) mul = 0.5;
  else if (r < 75) mul = 1;
  else if (r < 90) mul = 1.5;
  else if (r < 100) {
    // 남은 10%를 2 / 4 / 8 로 쪼개기 (10,4,1%)
    const r2 = (r - 90) / 10 * 100; // 0~100
    if (r2 < 60) mul = 2;  // 6%
    else if (r2 < 96) mul = 4; // 3.6% ~ 가깝게 조정
    else mul = 8; // 0.4% (근사) — 정확히 10/4/1을 원하면 위 로직을 정확 비율로 나눠도 됨
  }

  // 결과 저장
  const slot = await MoonSlot.create({ slotId, multiplier: mul });

  // 모든 베팅 정산
  const bets = await MoonBet.find({ slotId });
  for (const b of bets) {
    const user = await User.findOne({ seq: b.userSeq });
    if (!user) continue;
    user.moonPoints = (user.moonPoints || 0) + (b.amount * mul);
    await user.save();
  }

  return res.json(slot);
});

// 4) 해당 슬롯 로그
router.get('/logs/:slotId', async (req, res) => {
  const slotId = req.params.slotId;
  const slot = await MoonSlot.findOne({ slotId }).lean();
  const bets = await MoonBet.find({ slotId }).lean();
  return res.json({ slot, bets });
});

// 5) 마켓 목록
router.get('/market', ensureJwt, async (req, res) => {
  const me = req.user as any;
  const u = await User.findOne({ seq: me.seq }).lean();
  const bought = new Set(u?.moonPurchases || []);
  res.json({
    items: ITEMS.map(it => ({ ...it, bought: bought.has(it.id) }))
  });
});

// 6) 구매
router.post('/market/buy', ensureJwt, async (req, res) => {
  if (!isWithinEvent()) return res.status(400).json({ error: '이벤트 기간이 아닙니다.' });
  const me = req.user as any;
  const { itemId } = req.body as { itemId: string };
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return res.status(400).json({ error: '상품 없음' });

  const user = await User.findOne({ seq: me.seq });
  if (!user) return res.status(404).json({ error: '유저 없음' });

  if ((user.moonPurchases || []).includes(itemId))
    return res.status(400).json({ error: '이미 구매한 상품입니다.' });

  if ((user.moonPoints || 0) < item.price)
    return res.status(400).json({ error: '보름달코인이 부족합니다.' });

  user.moonPoints -= item.price;
  user.moonPurchases = [...(user.moonPurchases || []), itemId];
  await user.save();

  await MoonPurchase.create({ userSeq: me.seq, itemId, price: item.price });
  res.json({ ok: true, remain: user.moonPoints });
});

// 7) (관리자 전용) 구매내역
router.get('/market/purchases', ensureJwt, async (req, res) => {
  const me = req.user as any;
  if (me.seq !== 1) return res.status(403).json({ error: 'Forbidden' });
  const list = await MoonPurchase.find().sort({ createdAt: -1 }).lean();
  res.json(list);
});

export default router;
