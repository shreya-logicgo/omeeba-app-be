import mongoose from "mongoose";
import {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
} from "../enums.js";

const contentReportSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    contentTypeRef: {
      type: String,
      enum: Object.values(ContentModelName),
      required: false,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
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
contentReportSchema.index({ contentType: 1, contentId: 1 });
contentReportSchema.index({ reportedBy: 1 });
contentReportSchema.index({ createdAt: -1 });
contentReportSchema.index({ categoryId: 1 });
contentReportSchema.index({ subCategoryId: 1 });
// Prevent duplicate reports from same user for same content
contentReportSchema.index({ contentType: 1, contentId: 1, reportedBy: 1 }, { unique: true });

// Pre-save hook to set contentTypeRef based on contentType
contentReportSchema.pre("save", function (next) {
  if (this.contentType && !this.contentTypeRef) {
    this.contentTypeRef = ContentTypeToModelName[this.contentType];
  }
  next();
});

const ContentReport = mongoose.model("ContentReport", contentReportSchema);

export default ContentReport;
