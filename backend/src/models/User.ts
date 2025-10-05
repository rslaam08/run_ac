import { Schema, model, Document, Types } from 'mongoose';

export interface IUser {
  googleId: string;
  name:     string;
  intro:    string;
  seq:      number;
  isAdmin:  boolean;
  moonPoints: number;
  moonPurchases: string[];
}

export interface IUserDoc extends IUser, Document<Types.ObjectId> {}

const UserSchema = new Schema<IUserDoc>(
  {
    googleId:      { type: String, required: true, unique: true },
    name:          { type: String, required: true },
    intro:         { type: String, default: '' },
    seq:           { type: Number, required: true, unique: true },
    isAdmin:       { type: Boolean, default: false },
    moonPoints:    { type: Number, default: 0 },
    moonPurchases: { type: [String], default: [] },
  },
  { timestamps: true }
);

// 제네릭은 IUser(문서 shape) 기준으로!
const User = model<IUserDoc>('User', UserSchema);
export default User;
