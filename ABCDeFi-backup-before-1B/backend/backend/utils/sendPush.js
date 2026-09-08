const admin = require("../config/firebase");

const sendPushNotification = async (token, title, body) => {
    if (!token) return;

    const message = {
        token,
        notification: {
            title,
            body
        },
        android: {
            priority: "high",
            notification: {
                channelId: "high_importance_channel",
                sound: "default"
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: "default"
                }
            }
        }
    };

    try {
        await admin.messaging().send(message);
        console.log("Push notification sent");
    } catch (err) {
        console.error("FCM Error:", err);
    }
};

module.exports = sendPushNotification;