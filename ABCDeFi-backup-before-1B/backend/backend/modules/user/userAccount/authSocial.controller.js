const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple');
const https = require('https');
const jwt = require('jsonwebtoken');
const UserAccount = require('./userAccount.model');
const config = require("../../../config/default");

if (config.google_id && config.google_secret) {
    passport.use(new GoogleStrategy({
        clientID: config.google_id,
        clientSecret: config.google_secret,
        callbackURL: '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await UserAccount.findOne({ googleId: profile.id });
            if (!user) {
                user = await UserAccount.findOne({ email: profile.emails[0].value });
                if (user) {
                    user.googleId = profile.id;
                    await user.save();
                } else {
                    user = await UserAccount.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        status: true,
                    });
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

if (config.fb_id && config.fb_secret) {
    passport.use(new FacebookStrategy({
        clientID: config.fb_id,
        clientSecret: config.fb_secret,
        callbackURL: '/api/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'emails']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await UserAccount.findOne({ facebookId: profile.id });
            if (!user) {
                user = await UserAccount.findOne({ email: profile.emails[0].value });
                if (user) {
                    user.facebookId = profile.id;
                    await user.save();
                } else {
                    user = await UserAccount.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        facebookId: profile.id,
                        status: true,
                    });
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

if (config.apple_id && config.apple_team_id && config.apple_key_id && config.apple_private_key) {
    passport.use(new AppleStrategy({
        clientID: config.apple_id,
        teamID: config.apple_team_id,
        keyID: config.apple_key_id,
        privateKeyLocation: config.apple_private_key,
        callbackURL: '/api/auth/apple/callback',
    }, async (accessToken, refreshToken, idToken, profile, done) => {
        try {
            let user = await UserAccount.findOne({ appleId: idToken.sub });
            if (!user) {
                user = await UserAccount.findOne({ email: idToken.email });
                if (user) {
                    user.appleId = idToken.sub;
                    await user.save();
                } else {
                    user = await UserAccount.create({
                        name: idToken.email,
                        email: idToken.email,
                        appleId: idToken.sub,
                        status: true,
                    });
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

const generateJwtToken = (user) => jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    config.jwt,
    { expiresIn: '1d' }
);

const verifyGoogleIdToken = (token) => new Promise((resolve, reject) => {
    const url = new URL(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    https.get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const payload = JSON.parse(rawData);
                if (res.statusCode === 200 && payload.email && payload.sub) {
                    resolve(payload);
                } else {
                    reject(new Error(payload.error_description || payload.error || 'Invalid Google ID token'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }).on('error', reject);
});

const verifyFacebookAccessToken = (accessToken) => new Promise((resolve, reject) => {
    const url = new URL(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
    https.get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const payload = JSON.parse(rawData);
                if (res.statusCode === 200 && payload.id) {
                    resolve(payload);
                } else {
                    reject(new Error(payload.error?.message || 'Invalid Facebook access token'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }).on('error', reject);
});

const findOrCreateSocialUser = async ({ provider, providerId, email, name }) => {
    const providerKey = provider === 'google' ? 'googleId' : 'facebookId';
    let user = await UserAccount.findOne({ [providerKey]: providerId });

    if (!user) {
        if (!email) {
            throw new Error('Email is required for social login');
        }

        user = await UserAccount.findOne({ email });
        if (user) {
            user[providerKey] = providerId;
            await user.save();
        } else {
            user = await UserAccount.create({
                name: name || email,
                email,
                [providerKey]: providerId,
                status: true,
            });
        }
    }

    return user;
};

exports.googleMobileLogin = async (req, res, next) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    try {
        const payload = await verifyGoogleIdToken(token);
        const user = await findOrCreateSocialUser({
            provider: 'google',
            providerId: payload.sub,
            email: payload.email,
            name: payload.name || payload.email
        });

        const authToken = generateJwtToken(user);
        return res.status(200).json({ success: true, message: 'Login successful', token: authToken, user });
    } catch (err) {
        next(err);
    }
};

exports.facebookMobileLogin = async (req, res, next) => {
    const { accessToken } = req.body;
    if (!accessToken) {
        return res.status(400).json({ success: false, message: 'Facebook access token is required' });
    }

    try {
        const payload = await verifyFacebookAccessToken(accessToken);
        const user = await findOrCreateSocialUser({
            provider: 'facebook',
            providerId: payload.id,
            email: payload.email,
            name: payload.name || payload.email
        });

        const authToken = generateJwtToken(user);
        return res.status(200).json({ success: true, message: 'Login successful', token: authToken, user });
    } catch (err) {
        next(err);
    }
};

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    const user = await UserAccount.findById(id);
    done(null, user);
});