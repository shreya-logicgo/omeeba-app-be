import mongoose from "mongoose";

const musicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      required: true,
      trim: true,
    },
    album: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      required: true, // in seconds
    },
    category: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "",
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
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
musicSchema.index({ isTrending: 1, isActive: 1 });
musicSchema.index({ category: 1 });
musicSchema.index({ language: 1 });

const Music = mongoose.model("Music", musicSchema);

export default Music;

