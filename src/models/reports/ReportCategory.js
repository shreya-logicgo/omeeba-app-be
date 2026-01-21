import mongoose from "mongoose";

const reportCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: name index is automatically created by unique: true
reportCategorySchema.index({ isActive: 1, displayOrder: 1 });

const ReportCategory = mongoose.model("ReportCategory", reportCategorySchema);

export default ReportCategory;
