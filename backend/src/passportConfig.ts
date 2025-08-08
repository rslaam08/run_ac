import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import User from './models/User';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET as string;
// 반드시 절대 URL이어야 합니다. (예: https://sshsrun-api.onrender.com/auth/google/callback)
const GOOGLE_CALLBACK_URL =
  (process.env.GOOGLE_CALLBACK_URL as string) || 'http://localhost:4000/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  // 환경변수 누락 시 바로 알 수 있게 로그
  console.error('[OAuth] GOOGLE_CLIENT_ID/SECRET is missing.');
}
console.log('[OAuth] GOOGLE_CALLBACK_URL =', GOOGLE_CALLBACK_URL);

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
      try {
        const googleId = profile.id;
        const name = profile.displayName || 'NoName';

        let user = await User.findOne({ googleId });
        if (!user) {
          const max = await User.findOne().sort({ seq: -1 }).lean();
          const nextSeq = (max?.seq || 0) + 1;
          user = await User.create({
            googleId,
            name,
            seq: nextSeq,
            intro: '',
            isAdmin: false,
          });
        }
        return done(null, user);
      } catch (e) {
        return done(e as any);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user as any);
  } catch (e) {
    done(e as any);
  }
});

export default passport;
