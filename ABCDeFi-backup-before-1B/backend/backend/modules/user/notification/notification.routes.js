const express = require("express");
const router = express.Router();
const Notification = require("./notification.model");
const auth = require("../../../middleware/authMiddleware");

router.post('/', auth, async (req, res) => {
    const userNotifications = await Notification.find({ userId: req.user.id }).sort({ time: -1 });
    res.json({ data: userNotifications });
});

router.post('/clear-notification/:id', auth, async (req, res) => {
    const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        userId: req.user.id
    });
    res.json({ success: !!notification, message: "Removed successfully" });
});

router.post('/clear', auth, async (req, res) => {
    await Notification.deleteMany({ userId: req.user.id });
    res.json({ success: true, message: "Notifcation cleared" });
});

router.post('/mark-read/:id', auth, async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { read: true },
        { new: true }
    );
    res.json({ success: Boolean(notification) });
});

module.exports = router;
