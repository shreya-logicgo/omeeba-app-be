import mongoose from "mongoose";

const reportSubCategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportCategory",
      required: true,
    },
    name: {
      type: String,
      required: true,
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
reportSubCategorySchema.index({ categoryId: 1, isActive: 1, displayOrder: 1 });

// Compound unique index to prevent duplicate sub-categories in same category
reportSubCategorySchema.index({ categoryId: 1, name: 1 }, { unique: true });

const ReportSubCategory = mongoose.model("ReportSubCategory", reportSubCategorySchema);

export default ReportSubCategory;
