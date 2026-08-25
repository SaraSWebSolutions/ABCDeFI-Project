const About = require("./about.model");

exports.add = async (req, res, next) => {
    const { content } = req.body;
    try {
        const contentData = await About.create({
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
        const about = await About.findById(id);
        if (!about) {
            return res.status(400).json({
                success: false,
                message: 'About data not found'
            })
        }
        const updatedData = await About.findByIdAndUpdate(
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

exports.listAbout = async (req, res, next) => {
    try {
        const aboutData = await About.find();
        res.status(200).json({
            success: true,
            data: aboutData
        })
    } catch (err) {
        next(err)
    }
}