import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { User } from '../models/User';
import { logger } from '../config/logger';

// Initialize Google OAuth Strategy only if credentials are available
export const initializeGoogleStrategy = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    logger.info('⚠️  Google OAuth credentials not found - Google auth will be disabled');
    logger.info('⚠️  Google OAuth credentials not found - Google auth will be disabled');
    return false;
  }

  logger.info('✅ Initializing Google OAuth strategy');
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || `${process.env.CLIENT_URL}/auth/google/callback`,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        try {
          // Check if user already exists with this Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            return done(null, user);
          }

          // Check if user exists with the same email
          user = await User.findOne({ email: profile.emails?.[0]?.value });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            user.profilePicture = profile.photos?.[0]?.value;
            await user.save();
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            firstName: profile.name?.givenName || 'Unknown',
            lastName: profile.name?.familyName || 'User',
            profilePicture: profile.photos?.[0]?.value,
            provider: 'google',
            isActive: true,
          });

          await newUser.save();
          done(null, newUser);
        } catch (error) {
          done(error, undefined);
        }
      }
    )
  );

  return true;
};

// Serialize user for session
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as any)._id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
