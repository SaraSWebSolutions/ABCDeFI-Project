const Admin = require("./admin.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../../../config/default");

exports.register = async (req, res, next) => {
    const { name, email, password } = req.body;
    try {
        const existUser = await Admin.findOne({ email: email });

        if (existUser) {
            return res.status(400).json({
                success: false,
                message: "Account already registered"
            });
        }
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "All details required" });
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long and include 1 uppercase letter, 1 number, and 1 special character"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = await Admin.create({
            name,
            email,
            password: hashedPassword
        });
        res.status(201).json({
            success: true,
            message: "Account registered successfully",
            data: userData
        });
    } catch (err) {
        next(err)
    }
}

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and Password required" });
        }
        const admin = await Admin.findOne({ email: email });
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Account not found. Kindly register"
            })
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        const token = jwt.sign(
            { id: admin._id, name: admin.name, email: admin.email },
            config.jwt,
            { expiresIn: "1d" }
        )
        res.status(200).json({
            success: true,
            message: "Logged in successfully",
            token: token
        })
    } catch (err) {
        next(err)
    }
}