import mongoose from "mongoose";
import {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
  ReportStatus,
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
      refPath: "contentTypeRef",
    },
    contentTypeRef: {
      type: String,
      enum: Object.values(ContentModelName),
      required: false,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      title: {
        type: String,
        required: true,
      },
      subtitle: {
        type: String,
        default: "",
      },
      description: {
        type: String,
        default: "",
      },
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
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
contentReportSchema.index({ status: 1, createdAt: -1 });

// Pre-save hook to set contentTypeRef based on contentType
contentReportSchema.pre("save", function (next) {
  if (this.contentType && !this.contentTypeRef) {
    this.contentTypeRef = ContentTypeToModelName[this.contentType];
  }
  next();
});

const ContentReport = mongoose.model("ContentReport", contentReportSchema);

export default ContentReport;
