import mongoose from "mongoose";

const commentReportSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportCategory",
      required: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportSubCategory",
      default: null,
    },
    details: {
      type: String,
      default: "",
      maxlength: 280,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes
commentReportSchema.index({ commentId: 1 });
commentReportSchema.index({ reportedBy: 1 });
commentReportSchema.index({ createdAt: -1 });
commentReportSchema.index({ categoryId: 1 });
commentReportSchema.index({ subCategoryId: 1 });
// Prevent duplicate reports from same user for same comment
commentReportSchema.index({ commentId: 1, reportedBy: 1 }, { unique: true });

const CommentReport = mongoose.model("CommentReport", commentReportSchema);

export default CommentReport;
