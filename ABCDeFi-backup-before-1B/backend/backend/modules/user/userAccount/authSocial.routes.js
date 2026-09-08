const express = require('express');
const passport = require('passport');
const { googleMobileLogin, facebookMobileLogin } = require('./authSocial.controller');
const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
    res.json({ success: true, user: req.user });
});
router.post('/google/mobile', googleMobileLogin);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), (req, res) => {
    res.json({ success: true, user: req.user });
});
router.post('/facebook/mobile', facebookMobileLogin);

router.get('/apple', passport.authenticate('apple'));
router.post('/apple/callback', passport.authenticate('apple', { session: false }), (req, res) => {
    res.json({ success: true, user: req.user });
});

module.exports = router;