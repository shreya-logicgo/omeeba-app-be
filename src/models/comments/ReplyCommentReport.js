import mongoose from "mongoose";

const replyCommentReportSchema = new mongoose.Schema(
  {
    replyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReplyComment",
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
replyCommentReportSchema.index({ replyId: 1 });
replyCommentReportSchema.index({ reportedBy: 1 });
replyCommentReportSchema.index({ createdAt: -1 });
replyCommentReportSchema.index({ categoryId: 1 });
replyCommentReportSchema.index({ subCategoryId: 1 });
// Prevent duplicate reports from same user for same reply
replyCommentReportSchema.index({ replyId: 1, reportedBy: 1 }, { unique: true });

const ReplyCommentReport = mongoose.model("ReplyCommentReport", replyCommentReportSchema);

export default ReplyCommentReport;

