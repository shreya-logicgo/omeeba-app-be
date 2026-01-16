import mongoose from "mongoose";
import { ZealStatus } from "../enums.js";

const zealDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileType: {
      type: String,
      enum: ["video", "image"],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    uploadUrl: {
      type: String,
      default: "",
      required: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ZealStatus),
      default: ZealStatus.DRAFT,
      required: true,
    },
    isUploaded: {
      type: Boolean,
      default: false,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
    // Multipart upload fields
    uploadId: {
      type: String,
      default: null,
    },
    chunkSize: {
      type: Number,
      default: null, // Size of each chunk in bytes
    },
    totalChunks: {
      type: Number,
      default: null,
    },
    uploadedParts: [
      {
        partNumber: {
          type: Number,
          required: true,
        },
        etag: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isMultipart: {
      type: Boolean,
      default: false,
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

// Indexes
zealDraftSchema.index({ userId: 1, createdAt: -1 });
zealDraftSchema.index({ storageKey: 1 });
// TTL index for automatic cleanup of expired drafts (after 24 hours)
zealDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

const ZealDraft = mongoose.model("ZealDraft", zealDraftSchema);

export default ZealDraft;

