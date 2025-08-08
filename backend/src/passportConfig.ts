import 'dotenv/config';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from './models/User';

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL:  '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  // 구글 프로필 받고 DB에 사용자 생성/조회
  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    const seq = (await User.countDocuments()) + 1;
    user = await User.create({ googleId: profile.id, name: profile.displayName, intro: '', seq });
  }
  // done에 유저 도큐먼트를 넘겨 줍니다
  done(null, user);
}));

// 로그인 성공 시 세션에 user.seq만 저장
passport.serializeUser((user: any, done) => {
  done(null, user.seq);
});

// 매 요청마다 시리얼라이즈된 seq로 실제 유저 도큐먼트 조회
passport.deserializeUser(async (seq: number, done) => {
  try {
    const user = await User.findOne({ seq });
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});
