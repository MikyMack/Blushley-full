const Testimonial = require('../models/Testimonials');


exports.createTestimonial = async (req, res) => {
    try {
        const { name, email, stars, content, consentToShare } = req.body;
        const testimonial = new Testimonial({
            name,
            email,
            stars,
            content,
            consentToShare
        });
        await testimonial.save();
        res.status(201).json({ message: 'Testimonial created successfully', testimonial });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create testimonial', error });
    }
};

exports.editTestimonial = async (req, res) => {
    try {
        const testimonialId = req.params.id;
        const updates = req.body;
        const testimonial = await Testimonial.findByIdAndUpdate(testimonialId, updates, { new: true, runValidators: true });
        if (!testimonial) {
            return res.status(404).json({ message: 'Testimonial not found' });
        }
        res.json({ message: 'Testimonial updated successfully', testimonial });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update testimonial', error });
    }
};


exports.listTestimonials = async (req, res) => {
    try {
        const testimonials = await Testimonial.find().sort({ createdAt: -1 });
        res.json(testimonials);
    } catch (error) {
        res.status(500).json({ message: 'Failed to list testimonials', error });
    }
};

exports.deleteTestimonial = async (req, res) => {
    try {
        const testimonialId = req.params.id;
        const testimonial = await Testimonial.findByIdAndDelete(testimonialId);
        if (!testimonial) {
            return res.status(404).json({ message: 'Testimonial not found' });
        }
        res.json({ message: 'Testimonial deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete testimonial', error });
    }
};
