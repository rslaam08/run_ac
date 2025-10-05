import { Schema, model } from 'mongoose';

const MoonPurchaseSchema = new Schema({
  userSeq: { type: Number, index: true },
  itemId:  { type: String, index: true },
  price:   { type: Number, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default model('MoonPurchase', MoonPurchaseSchema);
