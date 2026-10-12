const jwt = require("jsonwebtoken");
const config = require("../config/default");
const UserAccount = require("../modules/user/userAccount/userAccount.model");
const { isAdminRole, hasAdminPermission } = require("../modules/admin/adminPermissions.cjs");
const { isDelegationTargetRole, isMainApplicationAdmin } = require("../modules/admin/mainAdminDelegation.cjs");

const delegatedSessionIsLive = (source, target, decoded) => {
    if (!source || source.role !== "admin" || source.adminRole !== "super_admin" || !isMainApplicationAdmin(source) || !source.status || source.isSuspended) return false;
    if (!target || target.role !== "admin" || !target.status || target.isSuspended || !isAdminRole(target.adminRole) || !isDelegationTargetRole(target.adminRole)) return false;
    const session = (source.delegatedAdminSessions || []).find((entry) => String(entry.sessionId) === String(decoded.delegatedAdminSessionId));
    return Boolean(session
        && !session.revokedAt
        && !session.returnedAt
        && new Date(session.expiresAt).getTime() > Date.now()
        && String(session.targetAdminUserId) === String(decoded.id)
        && String(target._id) === String(decoded.id)
        && target.adminRole === session.targetAdminRole
        && session.sourceRefreshTokenHash === source.refreshToken);
};

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

    jwt.verify(token, config.jwt, async (err, decoded) => {
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
        try {
            if (decoded.delegatedAdminSessionId) {
                const [source, target] = await Promise.all([
                    UserAccount.findById(decoded.delegatedAdminSourceId)
                        .select("email role adminRole status isSuspended refreshToken delegatedAdminSessions"),
                    UserAccount.findById(decoded.id)
                        .select("_id role adminRole status isSuspended"),
                ]);
                if (!delegatedSessionIsLive(source, target, decoded)) {
                    return res.status(401).json({ success: false, message: "Delegated administrator session is no longer valid." });
                }
            }
            req.user = decoded;
            next();
        } catch (error) {
            next(error);
        }
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

const loadPersistedAdmin = async (req) => UserAccount.findById(req.user?.id).select("role adminRole");

const denyPermission = (res, permission) => res.status(403).json({
    error: "ADMIN_PERMISSION_DENIED",
    permission,
});

const requireAdminRole = (...allowedRoles) => async (req, res, next) => {
    try {
        const user = await loadPersistedAdmin(req);
        if (!user || user.role !== "admin" || !isAdminRole(user.adminRole) || !allowedRoles.includes(user.adminRole)) {
            return denyPermission(res, "admin.role");
        }
        req.adminAuthorization = { adminRole: user.adminRole };
        next();
    } catch (error) {
        next(error);
    }
};

const requireAdminPermission = (requiredPermission) => async (req, res, next) => {
    try {
        const permission = typeof requiredPermission === "function"
            ? await requiredPermission(req)
            : requiredPermission;
        if (typeof permission !== "string") return denyPermission(res, "unknown");
        const user = await loadPersistedAdmin(req);
        if (!user || user.role !== "admin" || !isAdminRole(user.adminRole) || !hasAdminPermission(user.adminRole, permission)) {
            return denyPermission(res, permission);
        }
        req.adminAuthorization = { adminRole: user.adminRole, permission };
        next();
    } catch (error) {
        next(error);
    }
};

module.exports.requireAdminRole = requireAdminRole;
module.exports.requireAdminPermission = requireAdminPermission;
module.exports._delegatedSessionIsLive = delegatedSessionIsLive;
