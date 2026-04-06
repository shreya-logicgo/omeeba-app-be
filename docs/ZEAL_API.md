# Zeal API Documentation

The Zeal module handles video and image posts with advanced audio processing capabilities.

**Base URL:** `https://<host>/api/v1/zeals`  
**Auth header:** `Authorization: Bearer <JWT>`

---

## Response Formats (Standard)

The standard response format used across all endpoints:

**Success:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "...",
  "errorType": "...",
  "error": "...",
  "data": null
}
```

---

# 1. Upload Flow

There are two primary ways to upload media for a Zeal:
1. **Server-side Chunked Upload**: The client sends the entire file once, and the server handles background chunking to storage.
2. **Client-side Direct Upload**: The client requests a pre-signed URL and uploads directly to storage.

---

## POST /upload

**Full URL:** `POST /api/v1/zeals/upload`  
**Access:** Private  
**Request Type:** `multipart/form-data`

**Description:** Uploads a file directly to the server. The server will automatically initiate a background chunked upload to cloud storage for large videos (>10MB).

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| file  | file | Yes      | Video or Image file |

**Response (201):**

```json
{
  "success": true,
  "message": "File upload started successfully",
  "data": {
    "zealDraftId": "65f...123",
    "uploadUrl": "https://storage.cdn.com/path/to/media.mp4",
    "headers": {},
    "expiresIn": 3600
  }
}
```

---

## POST /start

**Full URL:** `POST /api/v1/zeals/start`  
**Access:** Private  
**Request Body (JSON):**

| Field | Type | Required | Validation / Notes |
|-------|------|----------|---------------------|
| fileType | string | Yes | `video` or `image` |
| fileName | string | Yes | Original file name |
| fileSize | number | Yes | Size in bytes |
| mimeType | string | Yes | e.g., `video/mp4`, `image/jpeg` |

**Description:** Initiates an upload session and returns a pre-signed URL (for simple uploads) or a `zealDraftId` for multipart coordination.

**Response (200/201):**

```json
{
  "success": true,
  "message": "Pre-signed upload URL generated successfully",
  "data": {
    "zealDraftId": "65f...123",
    "uploadUrl": "https://presigned-url.storage.com/...",
    "headers": { "x-amz-acl": "public-read" },
    "expiresIn": 300
  }
}
```

---

# 2. Post Management

## POST /

**Full URL:** `POST /api/v1/zeals`  
**Access:** Private  
**Request Body (JSON):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| zealDraftId | string | Yes | The ID returned from `/upload` or `/start` |
| caption | string | No | Max 1000 characters |
| mentionedUserIds | array | No | Array of 24-char ObjectIds |
| audioAction | string | No | `original`, `mute`, or `replace` |
| musicId | string | Conditional | Required if `audioAction` is `replace` |
| musicStartTime | number | Conditional | Required if `audioAction` is `replace` (in seconds) |
| musicEndTime | number | Conditional | Required if `audioAction` is `replace` (in seconds) |
| isDevelopByAi | boolean | No | Default: `false` |

**Description:** Finalizes the Zeal post creation. Verifies the upload and starts background processing (transcoding, thumbnail generation, and optional audio handling).

**Response (201):**

```json
{
  "success": true,
  "message": "Zeal post created successfully. Processing in progress.",
  "data": {
    "zealId": "65f...post123",
    "status": "processing",
    "createdAt": "2024-03-20T10:00:00Z"
  }
}
```

---

## GET /:zealId/status

**Full URL:** `GET /api/v1/zeals/:zealId/status`  
**Access:** Private  

**Description:** Checks the current status of a Zeal post or its draft.

**Response (200):**

```json
{
  "success": true,
  "message": "Zeal status retrieved successfully",
  "data": {
    "zealId": "65f...123",
    "status": "published",
    "type": "post",
    "isUploaded": true,
    "processingError": null
  }
}
```

**Statuses:**
- `draft`: Media is still being uploaded/recorded.
- `processing`: Server is processing (transcoding/thumbnails).
- `action_required`: Copyright flagged; user must choose audio action.
- `published`: Post is live.
- `failed`: Processing failed.

---

## DELETE /:zealId

**Full URL:** `DELETE /api/v1/zeals/:zealId`  
**Access:** Private (Owner only)

**Description:** Deletes a Zeal post and its associated media from storage.

---

# 3. Audio Handling

## POST /:zealId/handle-audio

**Full URL:** `POST /api/v1/zeals/:zealId/handle-audio`  
**Access:** Private  
**Request Body (JSON):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| action | string | Yes | `original`, `mute`, or `replace` |
| musicId | string | Conditional | Required if action is `replace` |
| musicStartTime | number | No | Start offset in library track |
| musicEndTime | number | No | End offset in library track |

**Description:** Responds to an `action_required` status when copyright issues are detected. Triggers re-processing of the video with the chosen audio action.

**Response (200):**

```json
{
  "success": true,
  "message": "Audio action registered. Processing in background.",
  "data": {
    "zealId": "65f...123",
    "status": "processing"
  }
}
```

---

## GET /music

**Full URL:** `GET /api/v1/zeals/music`  
**Access:** Private  

**Query Parameters:**
- `category` (optional): Filter by music category.
- `language` (optional): Filter by language.
- `search` (optional): search by title.

**Description:** Retrieves a list of available tracks for audio replacement.

---

## GET /drafts/:draftId/audio

**Full URL:** `GET /api/v1/zeals/drafts/:draftId/audio`  
**Access:** Private  

**Description:** Retrieves the extracted audio URL from a video draft (if available). Used when a user wants to use the audio from an existing draft.

**Response (200):**

```json
{
  "success": true,
  "message": "Extracted audio retrieved successfully",
  "data": {
    "audioUrl": "https://storage.cdn.com/extracted-audio.mp3",
    "status": "ready"
  }
}
```
