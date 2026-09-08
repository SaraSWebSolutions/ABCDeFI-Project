const jwt = require("jsonwebtoken");
const config = require("../config/default");
const UserAccount = require("../modules/user/userAccount/userAccount.model");

const auth = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Authorization header missing"
        });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Bearer token missing"
        });
    }

    jwt.verify(token, config.jwt, (err, decoded) => {
        if (err) {
            // Distinguish between expired and invalid tokens
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Token expired. Please refresh your session."
                });
            }
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }
        req.user = decoded;
        next();
    });
};

module.exports = auth;

const requireAdmin = async (req, res, next) => {
    try {
        const user = await UserAccount.findById(req.user?.id).select("role");
        if (!user || user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Administrator access is required"
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};

module.exports.requireAdmin = requireAdmin;
