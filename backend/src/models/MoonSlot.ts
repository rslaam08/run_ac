import { Schema, model } from 'mongoose';

const MoonSlotSchema = new Schema({
  slotId: { type: String, unique: true },
  // multiplier: 0, 0.5, 1, 1.5, 2, 4, 8 중 하나
  multiplier: { type: Number, required: true },
  resolvedAt: { type: Date, default: Date.now }
});

export default model('MoonSlot', MoonSlotSchema);
