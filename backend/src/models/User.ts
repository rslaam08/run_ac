// backend/src/models/User.ts

import { Schema, model, Document } from 'mongoose';

interface IUser extends Document {
  googleId: string;
  name:     string;
  intro:    string;
  seq:      number;
  isAdmin:  boolean;
  moonPoints: Number;
  moonPurchases: [String];
}

const UserSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  intro:    { type: String, default: '' },
  seq:      { type: Number, required: true, unique: true },
  isAdmin:  { type: Boolean, default: false },
  moonPoints: { type: Number, default: 0 },
  moonPurchases: { type: [String], default: [] } // 구매한 itemId들
});

// 중복 인덱스 생성을 막기 위해 아래 두 줄을 제거했습니다.
// UserSchema.index({ googleId: 1 }, { unique: true });
// UserSchema.index({ seq:      1 }, { unique: true });

export default model<IUser>('User', UserSchema);
