/**
 * UserSession Model
 * Stores one document per active device session.
 * Raw refresh tokens are never stored; only bcrypt hashes and deterministic
 * fingerprints for indexed lookup are persisted.
 */

import mongoose from "mongoose";

const userSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    refreshTokenJti: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    refreshTokenFingerprint: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      default: null,
      trim: true,
    },
    deviceName: {
      type: String,
      default: "Unknown device",
      trim: true,
    },
    platform: {
      type: String,
      default: null,
      trim: true,
    },
    browser: {
      type: String,
      default: null,
      trim: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSessionSchema.index({ userId: 1, revokedAt: 1 });
// userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
userSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
userSessionSchema.index({ userId: 1, deviceId: 1 });
// userSessionSchema.index({ sessionId: 1 }, { unique: true });
// userSessionSchema.index({ refreshTokenJti: 1 }, { unique: true });
userSessionSchema.index({ sessionId: 1, revokedAt: 1, expiresAt: 1 });
userSessionSchema.index({
  sessionId: 1,
  refreshTokenJti: 1,
  refreshTokenFingerprint: 1,
});

const UserSession = mongoose.model("UserSession", userSessionSchema);

export default UserSession;
