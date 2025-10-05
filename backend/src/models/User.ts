import { Schema, model, HydratedDocument } from 'mongoose';

export interface IUser {
  googleId: string;
  name:     string;
  intro:    string;
  seq:      number;
  isAdmin:  boolean;

  // ✨ TS에서는 원시 타입 + 배열 표기
  moonPoints: number;
  moonPurchases: string[]; // 구매한 itemId들
}

// 몽구스 스키마는 기존처럼 [String] 사용 가능 (저장은 DB 레벨)
const UserSchema = new Schema<IUser>(
  {
    googleId:     { type: String, required: true, unique: true },
    name:         { type: String, required: true },
    intro:        { type: String, default: '' },
    seq:          { type: Number, required: true, unique: true },
    isAdmin:      { type: Boolean, default: false },
    moonPoints:   { type: Number, default: 0 },
    moonPurchases:{ type: [String], default: [] },
  },
  { timestamps: true }
);

// 몽구스 v6+ 권장 타입
export type UserDocument = HydratedDocument<IUser>;

export default model<UserDocument>('User', UserSchema);
