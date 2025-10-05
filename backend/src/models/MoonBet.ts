import { Schema, model, InferSchemaType } from 'mongoose';

const MoonBetSchema = new Schema(
  {
    /** 슬롯 식별자 (예: 20251006-21-10) */
    slotId:  { type: String, required: true, index: true },

    /** 유저 고유 seq */
    userSeq: { type: Number, required: true, index: true },

    /** 베팅 금액(보름달 코인) */
    amount:  { type: Number, required: true, min: 1 },

    /**
     * 정산 금액(= amount * multiplier)
     * - 결과 확정 전: null
     * - 결과 확정 후: 0, 0.5배, 1배, 1.5배, 2배, 4배, 8배 등 계산된 숫자
     */
    payout:  { type: Number, default: null },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: false // __v 제거(선택)
  }
);

/** 같은 슬롯에 같은 유저가 중복 베팅 못 하도록 보장 */
MoonBetSchema.index({ slotId: 1, userSeq: 1 }, { unique: true });

export type MoonBetDoc = InferSchemaType<typeof MoonBetSchema>;
export default model<MoonBetDoc>('MoonBet', MoonBetSchema);
