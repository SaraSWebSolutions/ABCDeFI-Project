const FAQ = require("./faq.model");

exports.createFAQ = async (req, res, next) => {
    try {
        const { question, answer } = req.body;

        const faq = await FAQ.create({
            question,
            answer
        });

        res.status(201).json({
            success: true,
            data: faq,
        });
    } catch (err) {
        next(err);
    }
};

exports.getFAQs = async (req, res, next) => {
    try {
        const faqs = await FAQ.find({ isActive: true }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: faqs.length,
            data: faqs,
        });
    } catch (err) {
        next(err);
    }
};

exports.getFAQById = async (req, res, next) => {
    try {
        const faq = await FAQ.findById(req.params.id);

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
        }

        res.status(200).json({
            success: true,
            data: faq,
        });
    } catch (err) {
        next(err);
    }
};

exports.updateFAQ = async (req, res, next) => {
    try {
        const { id, question, answer } = req.body;

        const faq = await FAQ.findByIdAndUpdate(
            id,
            { question, answer },
            { new: true, runValidators: true }
        );

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
        }

        res.status(200).json({
            success: true,
            data: faq,
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteFAQ = async (req, res, next) => {
    try {
        const { id } = req.body;

        const faq = await FAQ.findByIdAndDelete(id);

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "FAQ deleted successfully",
        });
    } catch (err) {
        next(err);
    }
};