import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface JWTPayload {
  _id: string;
  seq: number;
  name: string;
  isAdmin?: boolean;
}

export function signUserToken(user: { id: string; seq: number; name: string; isAdmin?: boolean }) {
  return jwt.sign(
    { _id: user.id, seq: user.seq, name: user.name, isAdmin: user.isAdmin } as JWTPayload,
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Authorization: Bearer <token>
export function ensureJwt(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    (req as any).jwtUser = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 선택: 토큰 유무만 파악하는 라이트 버전
export function readJwt(req: Request) {
  try {
    const auth = req.headers.authorization || '';
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
