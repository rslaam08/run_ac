// backend/src/models/Record.ts
import { Schema, model, Document } from 'mongoose';

export type RecordStatus = 'pending' | 'approved' | 'rejected';

interface IRecord extends Document {
  userSeq:  number;
  timeSec:  number;
  distance: number;
  date:     Date;
  imageUrl: string;
  status:   RecordStatus;
  createdAt: Date;
}

const RecordSchema = new Schema<IRecord>({
  userSeq:  { type: Number, required: true, index: true },
  timeSec:  { type: Number, required: true },
  distance: { type: Number, required: true },
  date:     { type: Date,   required: true },
  imageUrl: { type: String, required: true },
  status:   { type: String, enum: ['pending','approved','rejected'], default: 'pending' }
}, { timestamps: true });

export default model<IRecord>('Record', RecordSchema);
