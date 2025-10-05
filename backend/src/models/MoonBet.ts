// backend/src/models/MoonBet.ts
import mongoose from 'mongoose';

const MoonBetSchema = new mongoose.Schema({
  slotId: { type: String, required: true }, // 기존에 있으면 유지 (혹은 per-bet slotId 사용)
  userSeq: { type: Number, required: true },
  amount: { type: Number, required: true },
  // 추가 필드들:
  multiplier: { type: Number, default: 0 },    // 결정된 배수 (즉시 결정)
  payout: { type: Number, default: 0 },        // 지급액(amount * multiplier)
  resolvedAt: { type: Date, default: null },   // 결과가 결정된 시각
}, {
  timestamps: true
});

export default mongoose.model('MoonBet', MoonBetSchema);
