import mongoose from 'mongoose';

const MoonBetSchema = new mongoose.Schema(
  {
    // 즉시결과 방식에서도 slotId는 기록 보존/참조를 위해 유지합니다.
    slotId: { type: String, required: true, index: true },

    userSeq: { type: Number, required: true, index: true },
    amount:  { type: Number, required: true },

    // 즉시 결과 필드
    multiplier: { type: Number, default: 0 },
    payout:     { type: Number, default: 0 },
    resolvedAt: { type: Date,   default: null },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('MoonBet', MoonBetSchema);
