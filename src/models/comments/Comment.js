import mongoose from "mongoose";
import {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
} from "../enums.js";
import { getContentModelName } from "../utils/contentHelper.js";

const commentSchema = new mongoose.Schema(
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
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    mentionedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to set contentTypeRef based on contentType
commentSchema.pre("save", function (next) {
  if (this.contentType && !this.contentTypeRef) {
    this.contentTypeRef = getContentModelName(this.contentType);
  }
  next();
});

// Virtual to populate content
commentSchema.virtual("content", {
  ref: function () {
    return this.contentTypeRef;
  },
  localField: "contentId",
  foreignField: "_id",
  justOne: true,
});

// Indexes
commentSchema.index({ contentType: 1, contentId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });
commentSchema.index({ createdAt: -1 });
commentSchema.index({ mentionedUserIds: 1 });
commentSchema.index({ isDeleted: 1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
