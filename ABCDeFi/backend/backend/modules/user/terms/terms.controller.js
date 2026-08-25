const Terms = require("./terms.model");

exports.add = async (req, res, next) => {
    const { content } = req.body;
    try {
        const contentData = await Terms.create({
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
        const terms = await Terms.findById(id);
        if (!terms) {
            return res.status(400).json({
                success: false,
                message: 'Terms not found'
            })
        }
        const updatedData = await Terms.findByIdAndUpdate(
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

exports.listTerms = async (req, res, next) => {
    try {
        const termsData = await Terms.find();
        res.status(200).json({
            success: true,
            data: termsData
        })
    } catch (err) {
        next(err)
    }
}