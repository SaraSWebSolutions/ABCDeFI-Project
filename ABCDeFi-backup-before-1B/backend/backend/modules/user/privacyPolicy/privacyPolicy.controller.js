const PrivacyPolicy = require("./privacyPolicy.model");

exports.add = async (req, res, next) => {
    const { content } = req.body;
    try {
        const contentData = await PrivacyPolicy.create({
            content
        });
        res.status(200).json({
            success: true,
            message: "Added successfully",
            data: contentData
        })
    } catch (err) {
        next(err)
    }
}

exports.update = async (req, res, next) => {
    const { id, ...updateFields } = req.body;
    try {
        const privacyPolicy = await PrivacyPolicy.findById(id);
        if (!privacyPolicy) {
            return res.status(400).json({
                success: false,
                message: 'Privacy policy not found'
            })
        }
        const updatedData = await PrivacyPolicy.findByIdAndUpdate(
            id,
            updateFields,
            { new: true }
        )
        res.status(200).json({
            success: true,
            message: "Updated successfully",
            data: updatedData
        })
    } catch (err) {
        next(err)
    }
}

exports.listPrivayPolicy = async (req, res, next) => {
    try {
        const privacyData = await PrivacyPolicy.find();
        res.status(200).json({
            success: true,
            data: privacyData
        })
    } catch (err) {
        next(err)
    }
}