import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
    blog: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Blog',
        required: true,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: [true, 'Comment content cannot be empty'],
        maxlength: 500,
    },
    // We use a boolean flag for future moderation needs
    isApproved: {
        type: Boolean,
        default: true,
    }
}, { timestamps: true });

const Comment = mongoose.model('Comment', CommentSchema);

export default Comment;