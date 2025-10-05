import { Schema, model } from 'mongoose';

const MoonBetSchema = new Schema({
  slotId: { type: String, index: true },       // "YYYYMMDD-HH-mm"
  userSeq: { type: Number, index: true },
  amount: { type: Number, min: 1 },
  createdAt: { type: Date, default: Date.now }
});

export default model('MoonBet', MoonBetSchema);
