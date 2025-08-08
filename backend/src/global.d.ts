import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** 로그인한 유저의 seq(id) */
    userId?: number;
  }
}
