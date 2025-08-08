// backend/src/routes/user.ts
import { Router, Request, Response } from 'express';
import User from '../models/User';


const router = Router();

router.get('/', async (_req, res) => {
  try {
    const users = await User.find();
    // seq 와 name 만 보내줍니다
    const list = users.map(u => ({
      seq:  u.seq,
      name: u.name
    }));
    res.json(list);
  } catch (err) {
    console.error('유저 목록 조회 실패', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 유저 정보 조회
router.get('/:seq', async (req: Request, res: Response) => {
  const seq = Number(req.params.seq);
  const user = await User.findOne({ seq });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ name: user.name, intro: user.intro, seq: user.seq });
});

// 자기소개 수정 (본인만)
router.put('/:seq', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) 
    return res.status(401).json({ message: 'Unauthorized' });

  const seqParam = Number(req.params.seq);
  const sessionUser = req.user as any;
  if (sessionUser.seq !== seqParam) 
    return res.status(403).json({ message: 'Forbidden' });

  const { intro } = req.body;
  try {
    const updated = await User.findOneAndUpdate(
      { seq: seqParam },
      { intro },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json({ name: updated.name, intro: updated.intro, seq: updated.seq });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


export default router;

