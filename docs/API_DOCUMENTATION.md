# Omeba API Documentation (Per-API Detail)

**Base URL:** `https://<host>/api/v1`  
**Auth header (Private APIs):** `Authorization: Bearer <JWT>`

---

## Response formats (all APIs)

**Success (single resource):**
```json
{ "success": true, "message": "...", "data": { ... } }
```

**Success (paginated):**
```json
{
  "success": true,
  "message": "...",
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5, "hasNext": true, "hasPrev": false }
}
```

**Error:**
```json
{ "success": false, "message": "...", "errorType": "...", "error": "...", "data": null }
```

---

# 1. Health

---

## GET /health

**Full URL:** `GET /api/v1/health`  
**Access:** Public (no auth)

**Description:** API health check.

**Request:** No body, no query, no params.

**Response (200):**
```json
{
  "success": true,
  "message": "API is running",
  "version": "v1"
}
```

---

# 2. Auth

---

## POST /auth/register

**Full URL:** `POST /api/v1/auth/register`  
**Access:** Public

**Description:** Register a new user.

**Request body (JSON):**

| Field        | Type   | Required | Validation / Notes                    |
|-------------|--------|----------|----------------------------------------|
| email       | string | Yes      | Valid email                            |
| phoneNumber | number | Yes      | Positive integer                       |
| countryCode | string | Yes      | e.g. `+91`, `+1`                       |
| name        | string | Yes      | 2–100 characters                      |
| username    | string | Yes      | 3–30 chars, alphanumeric, lowercase   |
| password    | string | Yes      | Min length per project rules           |

**Response (201):** Success format; `data` = user/token as per implementation.

**Errors:** 400 validation, 409 if email/username exists, etc.

---

## POST /auth/verify-otp

**Full URL:** `POST /api/v1/auth/verify-otp`  
**Access:** Public

**Description:** Verify OTP for account verification or password reset.

**Request body (JSON):**

| Field | Type   | Required | Notes                                  |
|-------|--------|----------|----------------------------------------|
| email | string | Yes      | User email                             |
| otp   | number | Yes      | Integer OTP                            |
| type  | string | No       | `"account"` or `"password"` (optional)|

**Response (200):** Success; `data` as per implementation (e.g. token or message).

**Errors:** 400 invalid OTP / validation.

---

## POST /auth/resend-otp

**Full URL:** `POST /api/v1/auth/resend-otp`  
**Access:** Public

**Description:** Resend OTP to user's email.

**Request body (JSON):**

| Field | Type   | Required |
|-------|--------|----------|
| email | string | Yes      |

**Response (200):** Success with message.

**Errors:** 400 validation, 404 if user not found.

---

## POST /auth/login

**Full URL:** `POST /api/v1/auth/login`  
**Access:** Public

**Description:** Login; returns JWT and user info.

**Request body (JSON):**

| Field    | Type   | Required |
|----------|--------|----------|
| email    | string | Yes      |
| password | string | Yes      |

**Response (200):** Success; `data` typically includes `token`, `user`.

**Errors:** 401 invalid credentials, 400 validation.

---

## POST /auth/forgot-password

**Full URL:** `POST /api/v1/auth/forgot-password`  
**Access:** Public

**Description:** Send OTP for password reset.

**Request body (JSON):**

| Field | Type   | Required |
|-------|--------|----------|
| email | string | Yes      |

**Response (200):** Success message.

**Errors:** 400 validation.

---

## POST /auth/reset-password

**Full URL:** `POST /api/v1/auth/reset-password`  
**Access:** Public

**Description:** Reset password after OTP verified (use `/verify-otp` with `type: "password"` first).

**Request body (JSON):**

| Field       | Type   | Required |
|------------|--------|----------|
| email      | string | Yes      |
| newPassword| string | Yes      |

**Response (200):** Success.

**Errors:** 400 validation / invalid or expired OTP.

---

## PUT /auth/change-password

**Full URL:** `PUT /api/v1/auth/change-password`  
**Access:** Private

**Description:** Change password for authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required |
|------------|--------|----------|
| oldPassword| string | Yes      |
| newPassword| string | Yes      |

**Response (200):** Success.

**Errors:** 400 wrong old password / validation, 401 unauthorized.

---

# 3. Users

---

## PUT /users/profile

**Full URL:** `PUT /api/v1/users/profile`  
**Access:** Private

**Description:** Update own profile. Image upload may use multipart/form-data.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON or multipart):** All fields optional; only send fields to update.

| Field       | Type   | Required | Validation / Notes              |
|------------|--------|----------|----------------------------------|
| name       | string | No       | 1–100 chars                      |
| username   | string | No       | 3–30 chars, letters/numbers/_    |
| bio        | string | No       | Max 500                          |
| profileImage | string | No     | URI or empty                     |
| coverImage | string | No       | URI or empty                     |

**Response (200):** Success; `data` = updated user profile.

**Errors:** 400 validation, 409 username taken, 401 unauthorized.

---

## GET /users/profile

**Full URL:** `GET /api/v1/users/profile`  
**Access:** Private

**Description:** Get current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Request:** No body, no query, no params.

**Response (200):** Success; `data` = user profile object.

**Errors:** 401 unauthorized.

---

## GET /users/:userId/profile

**Full URL:** `GET /api/v1/users/:userId/profile`  
**Access:** Private

**Description:** Get a user's profile by ID (includes follow status for current user).

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| userId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = user profile (e.g. id, name, username, profileImage, bio, isVerifiedBadge, followerCount, followingCount, followStatus).

**Errors:** 400 invalid userId, 404 user not found, 401 unauthorized.

---

## GET /users/search

**Full URL:** `GET /api/v1/users/search`  
**Access:** Private

**Description:** Search users by username (partial match). Excludes current user and deleted users. Returns follow status.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param    | Type   | Required | Default | Notes                          |
|----------|--------|----------|---------|--------------------------------|
| username | string | No       | -       | Search term (min 1 char)       |
| search   | string | No       | -       | Same as username (alternative) |
| page     | number | No       | 1       | Page number                    |
| limit    | number | No       | 20      | Items per page                 |

**Search behaviour:** Case-insensitive partial match on `username`. Empty search can return empty list or first page.

**Response (200):** Paginated. `data` = array of users (id, username, name, profileImage, bio, followerCount, followingCount, status: "following" | "not_following"). `pagination` = standard.

**Errors:** 400 validation, 401 unauthorized.

---

## GET /users/mentions/search

**Full URL:** `GET /api/v1/users/mentions/search`  
**Access:** Private

**Description:** Search users for @mention autocomplete (username starts with query). No pagination.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param | Type   | Required | Default | Notes                |
|-------|--------|----------|---------|----------------------|
| q     | string | No       | -       | Search term (1–50)   |
| query | string | No       | -       | Same as q            |
| limit | number | No       | 10      | Max results (1–20)   |

**Search behaviour:** Username **starts with** search term (case-insensitive). Returns minimal user fields for suggestions.

**Response (200):** Success; `data` = array of user objects (not paginated; length ≤ limit).

**Errors:** 400 validation, 401 unauthorized.

---

## GET /users/posts

**Full URL:** `GET /api/v1/users/posts`  
**Access:** Private

**Description:** Get posts by user (default: current user). Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param  | Type   | Required | Default | Notes                    |
|--------|--------|----------|---------|--------------------------|
| userId | string | No       | current | Filter by user ObjectId  |
| date   | string | No       | -       | Not used for posts       |
| page   | number | No       | 1       | Page number              |
| limit  | number | No       | 20      | Items per page           |

**Response (200):** Paginated. `data` = array of posts with metadata (likeCount, commentCount, isLiked, isSaved, shareableLink, etc.). `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /users/write-posts

**Full URL:** `GET /api/v1/users/write-posts`  
**Access:** Private

**Description:** Get write posts by user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param  | Type   | Required | Default | Notes                   |
|--------|--------|----------|---------|-------------------------|
| userId | string | No       | current | Filter by user ObjectId |
| date   | string | No       | -       | YYYY-MM-DD filter       |
| page   | number | No       | 1       | Page number             |
| limit  | number | No       | 20      | Items per page          |

**Response (200):** Paginated. `data` = array of write posts with metadata. `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /users/polls

**Full URL:** `GET /api/v1/users/polls`  
**Access:** Private

**Description:** Get polls by user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param  | Type   | Required | Default | Notes                   |
|--------|--------|----------|---------|-------------------------|
| userId | string | No       | current | Filter by user ObjectId |
| page   | number | No       | 1       | Page number             |
| limit  | number | No       | 20      | Items per page          |

**Response (200):** Paginated. `data` = array of polls with metadata. `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /users/mentioned-posts

**Full URL:** `GET /api/v1/users/mentioned-posts`  
**Access:** Private

**Description:** Get posts (Post + WritePost) where the user is mentioned. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param  | Type   | Required | Default | Notes          |
|--------|--------|----------|---------|----------------|
| userId | string | No       | -       | User ObjectId  |
| page   | number | No       | 1       | Page number    |
| limit  | number | No       | 20      | Items per page |

**Response (200):** Paginated. `data` = array of posts. `pagination` = standard.

**Errors:** 401 unauthorized.

---

# 4. Home Feed

---

## GET /home

**Full URL:** `GET /api/v1/home`  
**Access:** Private

**Description:** Home feed: followed users’ content first, then trending, then latest (deduplicated). Filter by content type with `item`.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param | Type   | Required | Default | Notes                                                                 |
|-------|--------|----------|---------|-----------------------------------------------------------------------|
| item  | string | No       | all     | `all` \| `post` \| `posts` \| `write` \| `writes` \| `zeal` \| `zeels` \| `zeals` \| `poll` \| `polls` |
| page  | number | No       | 1       | Page number                                                           |
| limit | number | No       | 20      | 1–100                                                                 |

**Response (200):** Paginated. `data` = feed items (structure depends on `item`). `pagination` = standard.

**Errors:** 400 invalid `item`, 401 unauthorized.

---

# 5. Chat

---

## POST /chat/rooms/create

**Full URL:** `POST /api/v1/chat/rooms/create`  
**Access:** Private

**Description:** Get existing chat room or create new one with another user.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field        | Type   | Required | Notes                          |
|-------------|--------|----------|--------------------------------|
| otherUserId | string | Yes      | 24-char ObjectId               |
| chatType    | string | No       | `"Direct"` \| `"Request"`; default Direct |

**Response (200):** Success; `data` = room object (id, roomId, chatType, otherUser, isBlocked, createdAt, updatedAt).

**Errors:** 400 validation (e.g. invalid otherUserId), 401 unauthorized.

---

## GET /chat/rooms

**Full URL:** `GET /api/v1/chat/rooms`  
**Access:** Private

**Description:** List chat rooms (inbox) for current user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param | Type   | Required | Default | Notes        |
|-------|--------|----------|---------|--------------|
| page  | number | No       | 1       | Page number  |
| limit | number | No       | 20      | Max 100      |

**Response (200):** Paginated. `data` = array of rooms (id, roomId, chatType, otherUser, lastMessage, lastMessageType, lastMessageStatus, lastMessageAt, unreadCount, isBlocked, createdAt, updatedAt). `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /chat/rooms/:roomId

**Full URL:** `GET /api/v1/chat/rooms/:roomId`  
**Access:** Private

**Description:** Get single chat room by ID.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| roomId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = room object (id, roomId, chatType, otherUser, lastMessage, lastMessageType, lastMessageAt, unreadCount, isBlocked, createdAt, updatedAt).

**Errors:** 400 invalid roomId, 404 room not found, 401 unauthorized.

---

## DELETE /chat/rooms/:roomId

**Full URL:** `DELETE /api/v1/chat/rooms/:roomId`  
**Access:** Private

**Description:** Permanently delete chat room and all its messages. User can create a new room with same person later.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| roomId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; message e.g. "Chat room deleted successfully".

**Errors:** 400 invalid roomId, 404 room not found, 401 unauthorized.

---

## GET /chat/rooms/:roomId/messages

**Full URL:** `GET /api/v1/chat/rooms/:roomId/messages`  
**Access:** Private

**Description:** Get messages in a room. Paginated; newest first.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| roomId | string | Yes      | 24-char ObjectId|

**Query parameters:**

| Param | Type   | Required | Default | Notes       |
|-------|--------|----------|---------|-------------|
| page  | number | No       | 1       | Page number |
| limit | number | No       | 50      | Max 100     |

**Response (200):** Paginated. `data` = array of messages (id, roomId, sender, messageType, message, mediaUrl, thumbnailUrl, contentId, contentType, status, statusDisplay, timestamp, timeAgo, createdAt). `pagination` = standard.

**Errors:** 400 invalid roomId, 404 room not found / access denied, 401 unauthorized.

---

## POST /chat/rooms/:roomId/messages

**Full URL:** `POST /api/v1/chat/rooms/:roomId/messages`  
**Access:** Private

**Description:** Send a message in a chat room. At least one of message, mediaUrl, or contentId must be present.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| roomId | string | Yes      | 24-char ObjectId|

**Request body (JSON):**

| Field       | Type   | Required | Notes                                      |
|------------|--------|----------|--------------------------------------------|
| messageType| string | Yes      | `Text` \| `Image` \| `Snap` \| `Post` \| `Write Post` \| `Zeal` |
| message    | string | No       | Text body; max 5000                         |
| mediaUrl   | string | No       | URI (or use mediaId from media upload)     |
| thumbnailUrl | string | No     | Thumbnail URI                               |
| contentId  | string | No       | For shared post/write/zeal                 |
| contentType| string | No       | `Post` \| `Write Post` \| `Zeal`           |

**Response (201):** Success; `data` = created message object.

**Errors:** 400 validation / room not found / room blocked, 401 unauthorized.

---

## DELETE /chat/rooms/:roomId/messages/:messageId

**Full URL:** `DELETE /api/v1/chat/rooms/:roomId/messages/:messageId`  
**Access:** Private

**Description:** Delete a single message. Only the sender can delete their own message.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| roomId   | string | Yes      | 24-char ObjectId|
| messageId| string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = { roomId, messageId }.

**Errors:** 400 message not found / not your message / room not found, 401 unauthorized.

---

## POST /chat/rooms/:roomId/read

**Full URL:** `POST /api/v1/chat/rooms/:roomId/read`  
**Access:** Private

**Description:** Mark messages as read. If lastReadMessageId omitted, marks up to latest message.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| roomId | string | Yes      | 24-char ObjectId|

**Request body (JSON):**

| Field             | Type   | Required | Notes              |
|------------------|--------|----------|--------------------|
| lastReadMessageId| string | No       | Last read message ID|

**Response (200):** Success; `data` = e.g. { roomId, userId, lastReadMessageId, lastReadAt, unreadCount }.

**Errors:** 400 room not found / message not found, 401 unauthorized.

---

## GET /chat/rooms/:roomId/unread-count

**Full URL:** `GET /api/v1/chat/rooms/:roomId/unread-count`  
**Access:** Private

**Description:** Get unread message count for a specific room.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| roomId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = e.g. { unreadCount: number, roomId: string }.

**Errors:** 400 invalid roomId, 401 unauthorized.

---

## GET /chat/unread-count

**Full URL:** `GET /api/v1/chat/unread-count`  
**Access:** Private

**Description:** Get total unread message count across all rooms.

**Headers:** `Authorization: Bearer <token>`

**Request:** No body, no query, no params.

**Response (200):** Success; `data` = e.g. { unreadCount: number, roomId: null }.

**Errors:** 401 unauthorized.

---

# 6. Explore

---

## GET /explore/trending

**Full URL:** `GET /api/v1/explore/trending`  
**Access:** Public (optional auth for better filtering)

**Description:** Get trending/popular content for Explore.

**Query parameters:**

| Param       | Type   | Required | Default | Notes                          |
|------------|--------|----------|---------|--------------------------------|
| contentType| string | No       | all     | `all` \| `post` \| `write` \| `zeal` |
| page       | number | No       | 1       | Page number                    |
| limit      | number | No       | 20      | 1–100                          |

**Response (200):** Paginated. `data` = trending content items. `pagination` = standard.

**Errors:** 400 invalid contentType.

---

## GET /explore/search

**Full URL:** `GET /api/v1/explore/search`  
**Access:** Public (optional auth)

**Description:** Search by type. No pagination; max 15 results per type.

**Query parameters:**

| Param       | Type   | Required | Default | Notes                                                    |
|------------|--------|----------|---------|----------------------------------------------------------|
| query      | string | No       | -       | Search text (1–200 chars); can be empty                 |
| type       | string | Yes      | -       | `explore` \| `trending` \| `polls` \| `users` \| `hashtag` |
| contentType| string | No       | -       | For type=explore only: `zeal` \| `post`                 |

**Search behaviour:**
- **type=explore:** Zeal captions + Post captions; optional contentType to limit to zeal or post.
- **type=trending:** WritePost content (text search).
- **type=polls:** Poll captions (ACTIVE polls).
- **type=users:** User name/username (case-insensitive).
- **type=hashtag:** Hashtag tag (case-insensitive); returns tag + contentCount.

**Response (200):** Success; `data` = array (max 15 items). Not paginated.

**Errors:** 400 invalid type/contentType.

---

## GET /explore/hashtag/:hashtag

**Full URL:** `GET /api/v1/explore/hashtag/:hashtag`  
**Access:** Public (optional auth)

**Description:** Get content for a specific hashtag. Paginated.

**Path parameters:**

| Param   | Type   | Required | Notes        |
|---------|--------|----------|-------------|
| hashtag | string | Yes      | With or without # |

**Query parameters:**

| Param       | Type   | Required | Default    | Notes                          |
|------------|--------|----------|------------|--------------------------------|
| contentType| string | No       | all        | `all` \| `post` \| `write` \| `zeal` \| `poll` |
| sortBy     | string | No       | popularity | `relevance` \| `popularity` \| `recent` |
| page       | number | No       | 1          | Page number                    |
| limit      | number | No       | 20         | 1–100                          |

**Response (200):** Paginated. `data` = content items for hashtag. `pagination` = standard.

**Errors:** 400 invalid contentType/sortBy.

---

# 7. Follow

---

## POST /follow/:userId

**Full URL:** `POST /api/v1/follow/:userId`  
**Access:** Private

**Description:** Follow a user.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| userId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; message and/or data as per implementation.

**Errors:** 400 invalid userId / already following, 404 user not found, 401 unauthorized.

---

## DELETE /follow/:userId

**Full URL:** `DELETE /api/v1/follow/:userId`  
**Access:** Private

**Description:** Unfollow a user.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| userId | string | Yes      | 24-char ObjectId|

**Response (200):** Success.

**Errors:** 400 invalid userId, 401 unauthorized.

---

## GET /follow/:userId/status

**Full URL:** `GET /api/v1/follow/:userId/status`  
**Access:** Private

**Description:** Check if current user follows the given user.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| userId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = e.g. { isFollowing: boolean }.

**Errors:** 400 invalid userId, 401 unauthorized.

---

## GET /follow/followers

**Full URL:** `GET /api/v1/follow/followers`  
**Access:** Private

**Description:** Get followers list. If userId is "me" or omitted, returns current user's followers. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param  | Type   | Required | Default | Notes                    |
|--------|--------|----------|---------|--------------------------|
| userId | string | No       | me      | ObjectId or "me"         |
| search | string | No       | -       | Filter by username 1–100 |
| page   | number | No       | 1       | Page number              |
| limit  | number | No       | 20      | Items per page           |

**Response (200):** Paginated. `data` = array of users (id, username, name, profileImage, bio, isVerifiedBadge, followedAt, status). `pagination` = standard.

**Errors:** 400 invalid userId, 401 unauthorized.

---

## GET /follow/following

**Full URL:** `GET /api/v1/follow/following`  
**Access:** Private

**Description:** Get following list. Same as followers; userId "me" or omitted = current user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:** Same as GET /follow/followers (userId, search, page, limit).

**Response (200):** Paginated. `data` = array of users. `pagination` = standard.

**Errors:** 400 invalid userId, 401 unauthorized.

---

## GET /follow/count

**Full URL:** `GET /api/v1/follow/count`  
**Access:** Private

**Description:** Get follower and following counts. userId "me" or omitted = current user.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param  | Type   | Required | Default | Notes            |
|--------|--------|----------|---------|------------------|
| userId | string | No       | me      | ObjectId or "me" |

**Response (200):** Success; `data` = e.g. { followersCount, followingCount }.

**Errors:** 400 invalid userId, 401 unauthorized.

---

# 8. Posts

---

## POST /posts

**Full URL:** `POST /api/v1/posts`  
**Access:** Private

**Description:** Create a new post. May use multipart for images.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON or multipart):**

| Field           | Type    | Required | Notes                    |
|----------------|---------|----------|--------------------------|
| caption        | string  | No       | Max 500, can be ""        |
| images         | string[]| No       | Array of image URLs, 1–20|
| mentionedUserIds | string[]| No     | Array of user ObjectIds   |
| musicId        | string  | No       | ObjectId or null          |
| musicStartTime | number  | No       | Integer ≥ 0               |
| musicEndTime   | number  | No       | Integer ≥ 0               |

**Response (201):** Success; `data` = created post.

**Errors:** 400 validation, 401 unauthorized.

---

# 9. Write Posts

---

## POST /write-posts

**Full URL:** `POST /api/v1/write-posts`  
**Access:** Private

**Description:** Create a new write post.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field           | Type    | Required | Notes                  |
|----------------|---------|----------|------------------------|
| content        | string  | Yes      | 1–10000 characters    |
| mentionedUserIds | string[]| No     | Array of user ObjectIds|

**Response (201):** Success; `data` = created write post.

**Errors:** 400 validation, 401 unauthorized.

---

# 10. Zeals

---

## POST /zeals/upload

**Full URL:** `POST /api/v1/zeals/upload`  
**Access:** Private

**Description:** Upload file (multipart). Server-side chunking.

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form with file.

**Response (200):** Success; `data` = upload result (e.g. draft ID for use in POST /zeals).

**Errors:** 400 validation, 401 unauthorized.

---

## POST /zeals/start

**Full URL:** `POST /api/v1/zeals/start`  
**Access:** Private

**Description:** Start Zeal upload; get pre-signed URL for client upload.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field    | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| fileType | string | Yes      | `video` \| `image` |
| fileName | string | Yes      | 1–255 chars     |
| fileSize | number | Yes      | Positive integer|
| mimeType | string | Yes      | 1–100 chars     |

**Response (200):** Success; `data` = pre-signed URL / upload info.

**Errors:** 400 validation, 401 unauthorized.

---

## POST /zeals

**Full URL:** `POST /api/v1/zeals`  
**Access:** Private

**Description:** Create Zeal post after upload (verify upload and start processing).

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field           | Type    | Required | Notes              |
|----------------|---------|----------|--------------------|
| zealDraftId    | string  | Yes      | ObjectId from upload |
| caption        | string  | No       | 0–2000 chars       |
| mentionedUserIds | string[]| No     | Default []         |
| musicId        | string  | No       | ObjectId           |
| musicStartTime | number  | No       | ≥ 0                |
| musicEndTime   | number  | No       | ≥ 0                |
| isDevelopByAi  | boolean | No       |                    |

**Response (201):** Success; `data` = created zeal.

**Errors:** 400 validation, 401 unauthorized.

---

## GET /zeals/:zealId/status

**Full URL:** `GET /api/v1/zeals/:zealId/status`  
**Access:** Private

**Description:** Get Zeal processing status.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| zealId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = status object.

**Errors:** 400 invalid zealId, 404 not found, 401 unauthorized.

---

# 11. Polls

---

## POST /polls

**Full URL:** `POST /api/v1/polls`  
**Access:** Private

**Description:** Create a new poll.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field    | Type   | Required | Notes                        |
|----------|--------|----------|------------------------------|
| caption  | string | Yes      | Max 500                      |
| options  | string[]| Yes     | 2–10 options, each 1–200 chars|
| duration | string | Yes      | ISO date, must be in future   |

**Response (201):** Success; `data` = created poll.

**Errors:** 400 validation, 401 unauthorized.

---

## GET /polls/:pollId

**Full URL:** `GET /api/v1/polls/:pollId`  
**Access:** Private

**Description:** Get poll by ID.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| pollId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = poll with options and vote info.

**Errors:** 400 invalid pollId, 404 not found, 401 unauthorized.

---

## POST /polls/:pollId/vote

**Full URL:** `POST /api/v1/polls/:pollId/vote`  
**Access:** Private

**Description:** Vote on a poll.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param  | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| pollId | string | Yes      | 24-char ObjectId|

**Request body (JSON):**

| Field   | Type   | Required | Notes        |
|---------|--------|----------|-------------|
| optionId| string | Yes      | Option ID   |

**Response (200):** Success; `data` = updated poll / vote result.

**Errors:** 400 invalid pollId/optionId / already voted / poll ended, 401 unauthorized.

---

# 12. Comments

---

## GET /comments

**Full URL:** `GET /api/v1/comments`  
**Access:** Private

**Description:** Get comments for content. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param       | Type   | Required | Default | Notes                          |
|------------|--------|----------|---------|--------------------------------|
| contentType| string | Yes      | -       | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string | Yes      | -       | 24-char ObjectId               |
| page       | number | No       | 1       | Page number                    |
| limit      | number | No       | 20      | Items per page                 |

**Response (200):** Paginated. `data` = array of comments (with reply count, like count, isLiked, etc.). `pagination` = standard.

**Errors:** 400 validation, 404 content not found, 401 unauthorized.

---

## POST /comments

**Full URL:** `POST /api/v1/comments`  
**Access:** Private (rate limited)

**Description:** Create a comment on content.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required | Notes                          |
|------------|--------|----------|--------------------------------|
| contentType| string | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string | Yes      | 24-char ObjectId               |
| comment    | string | Yes      | 1–1000 chars, trimmed          |

**Response (201):** Success; `data` = created comment.

**Errors:** 400 validation, 404 content not found, 401 unauthorized, 429 rate limit.

---

## GET /comments/:commentId

**Full URL:** `GET /api/v1/comments/:commentId`  
**Access:** Private

**Description:** Get single comment by ID.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| commentId| string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = comment object.

**Errors:** 400 invalid commentId, 404 not found / hidden, 401 unauthorized.

---

## DELETE /comments/:commentId

**Full URL:** `DELETE /api/v1/comments/:commentId`  
**Access:** Private

**Description:** Soft-delete own comment.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| commentId| string | Yes      | 24-char ObjectId|

**Response (200):** Success.

**Errors:** 400 invalid commentId, 403 not your comment, 404 not found, 401 unauthorized.

---

## POST /comments/:commentId/like

**Full URL:** `POST /api/v1/comments/:commentId/like`  
**Access:** Private

**Description:** Toggle like on comment (like if not liked, unlike if liked).

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| commentId| string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = e.g. { isLiked, likeCount }.

**Errors:** 400 invalid commentId, 404 not found, 401 unauthorized.

---

## POST /comments/:commentId/report

**Full URL:** `POST /api/v1/comments/:commentId/report`  
**Access:** Private

**Description:** Report a comment.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| commentId| string | Yes      | 24-char ObjectId|

**Request body (JSON):**

| Field         | Type   | Required | Notes    |
|--------------|--------|----------|----------|
| subCategoryId| string | Yes      | ObjectId |
| details      | string | No       | Max 280  |

**Response (200):** Success.

**Errors:** 400 validation, 404 not found, 401 unauthorized.

---

## GET /comments/:commentId/replies

**Full URL:** `GET /api/v1/comments/:commentId/replies`  
**Access:** Private

**Description:** Get replies for a comment. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| commentId| string | Yes      | 24-char ObjectId|

**Query parameters:**

| Param | Type   | Required | Default | Notes       |
|-------|--------|----------|---------|-------------|
| page  | number | No       | 1       | Page number |
| limit | number | No       | 20      | Items per page |

**Response (200):** Paginated. `data` = array of replies. `pagination` = standard.

**Errors:** 400 invalid commentId, 404 not found, 401 unauthorized.

---

## POST /comments/:commentId/replies

**Full URL:** `POST /api/v1/comments/:commentId/replies`  
**Access:** Private (rate limited)

**Description:** Create a reply to a comment.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param     | Type   | Required | Notes           |
|----------|--------|----------|-----------------|
| commentId| string | Yes      | 24-char ObjectId|

**Request body (JSON):**

| Field | Type   | Required | Notes       |
|-------|--------|----------|------------|
| reply | string | Yes      | 1–1000 chars|

**Response (201):** Success; `data` = created reply.

**Errors:** 400 validation, 404 comment not found, 401 unauthorized, 429 rate limit.

---

# 13. Content Share

---

## GET /content-shares/users

**Full URL:** `GET /api/v1/content-shares/users`  
**Access:** Private

**Description:** Get eligible users for content sharing (followers, following, or searchable). Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param | Type   | Required | Default | Notes                                          |
|-------|--------|----------|---------|------------------------------------------------|
| search| string | No       | -       | Max 100 chars                                  |
| type  | string | No       | all     | `all` \| `followers` \| `following` \| `searchable` |
| page  | number | No       | 1       | Page number                                    |
| limit | number | No       | 20      | Items per page                                 |

**Response (200):** Paginated. `data` = array of users. `pagination` = standard.

**Errors:** 400 invalid type, 401 unauthorized.

---

## POST /content-shares/share

**Full URL:** `POST /api/v1/content-shares/share`  
**Access:** Private

**Description:** Share content with one or more users.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type    | Required | Notes                    |
|------------|---------|----------|--------------------------|
| contentType| string  | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string  | Yes      | 24-char ObjectId         |
| receiverIds | string[]| Yes      | 1–50 user ObjectIds     |

**Response (200/201):** Success; `data` as per implementation.

**Errors:** 400 validation / invalid receivers, 404 content not found, 401 unauthorized.

---

## GET /content-shares/sent

**Full URL:** `GET /api/v1/content-shares/sent`  
**Access:** Private

**Description:** Get shares sent by current user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:** page (optional), limit (optional).

**Response (200):** Paginated. `data` = array of shares. `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /content-shares/received

**Full URL:** `GET /api/v1/content-shares/received`  
**Access:** Private

**Description:** Get shares received by current user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:** page (optional), limit (optional).

**Response (200):** Paginated. `data` = array of shares. `pagination` = standard.

**Errors:** 401 unauthorized.

---

## POST /content-shares/count

**Full URL:** `POST /api/v1/content-shares/count`  
**Access:** Private

**Description:** Get share count for specific content.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required | Notes                    |
|------------|--------|----------|--------------------------|
| contentType| string | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string | Yes      | 24-char ObjectId         |

**Response (200):** Success; `data` = e.g. { count: number }.

**Errors:** 400 validation, 401 unauthorized.

---

# 14. Saved Content

---

## POST /saved-content/toggle

**Full URL:** `POST /api/v1/saved-content/toggle`  
**Access:** Private

**Description:** Toggle save (save if not saved, unsave if saved).

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required | Notes                    |
|------------|--------|----------|--------------------------|
| contentType| string | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string | Yes      | 24-char ObjectId         |

**Response (200):** Success; `data` = e.g. { isSaved: boolean }.

**Errors:** 400 validation, 404 content not found, 401 unauthorized.

---

## POST /saved-content/save

**Full URL:** `POST /api/v1/saved-content/save`  
**Access:** Private

**Description:** Save content.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):** Same as toggle (contentType, contentId).

**Response (200):** Success.

**Errors:** 400 validation, 404 content not found, 401 unauthorized.

---

## POST /saved-content/unsave

**Full URL:** `POST /api/v1/saved-content/unsave`  
**Access:** Private

**Description:** Unsave content.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):** Same as toggle (contentType, contentId).

**Response (200):** Success.

**Errors:** 400 validation, 401 unauthorized.

---

## POST /saved-content/status

**Full URL:** `POST /api/v1/saved-content/status`  
**Access:** Private

**Description:** Get saved status for content (isSaved).

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):** Same as toggle (contentType, contentId).

**Response (200):** Success; `data` = e.g. { isSaved: boolean }.

**Errors:** 400 validation, 401 unauthorized.

---

## POST /saved-content/list

**Full URL:** `POST /api/v1/saved-content/list`  
**Access:** Private

**Description:** Get user's saved content list. Paginated. Filter by contentType.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required | Default | Notes                                    |
|------------|--------|----------|---------|------------------------------------------|
| contentType| string | No       | all     | `all` \| `Post` \| `Write Post` \| `Zeal Post` |
| page       | number | No       | 1       | Page number                              |
| limit      | number | No       | 20      | 1–100                                    |

**Response (200):** Paginated. `data` = array of saved content items with metadata. `pagination` = standard.

**Errors:** 400 validation, 401 unauthorized.

---

# 15. Notifications

---

## GET /notifications

**Full URL:** `GET /api/v1/notifications`  
**Access:** Private

**Description:** Get notifications for current user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param | Type   | Required | Default | Notes                    |
|-------|--------|----------|---------|--------------------------|
| status| string | No       | all     | `all` \| `unread` \| `read` |
| type  | string | No       | -       | NotificationType value   |
| page  | number | No       | 1       | Page number              |
| limit | number | No       | 20      | 1–100                    |

**Response (200):** Paginated. `data` = array of notifications. `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /notifications/unread-count

**Full URL:** `GET /api/v1/notifications/unread-count`  
**Access:** Private

**Description:** Get unread notification count.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success; `data` = e.g. { unreadCount: number }.

**Errors:** 401 unauthorized.

---

## PUT /notifications/:notificationId/read

**Full URL:** `PUT /api/v1/notifications/:notificationId/read`  
**Access:** Private

**Description:** Mark a notification as read.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param          | Type   | Required | Notes           |
|----------------|--------|----------|-----------------|
| notificationId | string | Yes      | 24-char ObjectId|

**Response (200):** Success.

**Errors:** 400 invalid ID, 404 not found, 401 unauthorized.

---

## PUT /notifications/read-all

**Full URL:** `PUT /api/v1/notifications/read-all`  
**Access:** Private

**Description:** Mark all notifications as read.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success.

**Errors:** 401 unauthorized.

---

## DELETE /notifications/:notificationId

**Full URL:** `DELETE /api/v1/notifications/:notificationId`  
**Access:** Private

**Description:** Delete a notification.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param          | Type   | Required | Notes           |
|----------------|--------|----------|-----------------|
| notificationId | string | Yes      | 24-char ObjectId|

**Response (200):** Success.

**Errors:** 400 invalid ID, 404 not found, 401 unauthorized.

---

## POST /notifications/fcm-token

**Full URL:** `POST /api/v1/notifications/fcm-token`  
**Access:** Private

**Description:** Register or update FCM token for push notifications.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field    | Type   | Required | Notes   |
|----------|--------|----------|---------|
| fcmToken | string | Yes      | Non-empty|

**Response (200):** Success.

**Errors:** 400 validation, 401 unauthorized.

---

## GET /notifications/fcm-token

**Full URL:** `GET /api/v1/notifications/fcm-token`  
**Access:** Private

**Description:** Get user's FCM tokens.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success; `data` = tokens list.

**Errors:** 401 unauthorized.

---

## DELETE /notifications/fcm-token

**Full URL:** `DELETE /api/v1/notifications/fcm-token`  
**Access:** Private

**Description:** Remove FCM token.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success.

**Errors:** 401 unauthorized.

---

## PUT /notifications/push-settings

**Full URL:** `PUT /api/v1/notifications/push-settings`  
**Access:** Private

**Description:** Enable or disable push notifications.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field   | Type    | Required | Notes   |
|---------|---------|----------|---------|
| enabled | boolean | Yes      | true/false |

**Response (200):** Success.

**Errors:** 400 validation, 401 unauthorized.

---

# 16. Snaps

---

## POST /snaps

**Full URL:** `POST /api/v1/snaps`  
**Access:** Private (rate limited)

**Description:** Create snap; get pre-signed upload URL. After upload, call POST /snaps/:snapId/confirm.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field           | Type    | Required | Notes                              |
|----------------|---------|----------|------------------------------------|
| recipientIds   | string[]| Yes      | 1–50 user ObjectIds                |
| mediaType      | string  | Yes      | `image` \| `video`                 |
| mimeType       | string  | Yes      | e.g. image/jpeg, video/mp4 (see validator) |
| duration       | number  | No       | Positive (for video)               |
| expiresInSeconds | number | No     | 60–604800 (1 min–7 days), default 86400 |

**Response (200/201):** Success; `data` = e.g. { snapId, uploadUrl, ... }.

**Errors:** 400 validation, 401 unauthorized, 429 rate limit.

---

## POST /snaps/:snapId/confirm

**Full URL:** `POST /api/v1/snaps/:snapId/confirm`  
**Access:** Private

**Description:** Confirm snap upload and deliver to recipients.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| snapId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = snap object.

**Errors:** 400 invalid snapId, 404 not found, 401 unauthorized.

---

## GET /snaps/:snapId/view

**Full URL:** `GET /api/v1/snaps/:snapId/view`  
**Access:** Private

**Description:** Get secure view URL for a snap.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param | Type   | Required | Notes           |
|--------|--------|----------|-----------------|
| snapId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = e.g. { viewUrl, expiresAt }.

**Errors:** 400 invalid snapId, 404 not found / expired, 401 unauthorized.

---

## GET /snaps/inbox

**Full URL:** `GET /api/v1/snaps/inbox`  
**Access:** Private

**Description:** Get received snaps. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param          | Type    | Required | Default | Notes           |
|----------------|---------|----------|---------|-----------------|
| page           | number  | No       | 1       | Page number     |
| limit          | number  | No       | 20      | 1–100           |
| includeExpired | boolean | No       | false   | Include expired |

**Response (200):** Paginated. `data` = array of snaps. `pagination` = standard.

**Errors:** 401 unauthorized.

---

## GET /snaps/sent

**Full URL:** `GET /api/v1/snaps/sent`  
**Access:** Private

**Description:** Get sent snaps. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:**

| Param | Type   | Required | Default | Notes       |
|-------|--------|----------|---------|-------------|
| page  | number | No       | 1       | Page number |
| limit | number | No       | 20      | 1–100       |

**Response (200):** Paginated. `data` = array of snaps. `pagination` = standard.

**Errors:** 401 unauthorized.

---

# 17. Media

---

## POST /media/upload

**Full URL:** `POST /api/v1/media/upload`  
**Access:** Private (rate limited)

**Description:** Upload image/video. Returns mediaId for use in Socket (send_message, send_snap) or API.

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form with file.

**Response (200/201):** Success; `data` = { mediaId, mediaUrl, thumbnailUrl, mediaType }.

**Errors:** 400 validation, 401 unauthorized, 429 rate limit.

---

# 18. Support

---

## POST /support/requests

**Full URL:** `POST /api/v1/support/requests`  
**Access:** Private

**Description:** Create support request (may auto-create chat room).

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required | Notes              |
|------------|--------|----------|--------------------|
| subject    | string | Yes      | Max 200            |
| description| string | Yes      | Max 1000           |
| priority   | string | No       | low \| medium \| high \| urgent |

**Response (201):** Success; `data` = created support request.

**Errors:** 400 validation, 401 unauthorized.

---

## GET /support/requests

**Full URL:** `GET /api/v1/support/requests`  
**Access:** Private

**Description:** Get support requests for current user. Paginated.

**Headers:** `Authorization: Bearer <token>`

**Query parameters:** page (optional), limit (optional).

**Response (200):** Paginated. `data` = array of support requests. `pagination` = standard.

**Errors:** 401 unauthorized.

---

# 19. Reports

---

## POST /reports

**Full URL:** `POST /api/v1/reports`  
**Access:** Private

**Description:** Create report for content.

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field        | Type   | Required | Notes                    |
|-------------|--------|----------|--------------------------|
| contentType | string | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId   | string | Yes      | 24-char ObjectId         |
| subCategoryId | string | Yes    | 24-char ObjectId         |
| details     | string | No       | Max 280                  |

**Response (200/201):** Success.

**Errors:** 400 validation, 404 content/category not found, 401 unauthorized.

---

## GET /reports/categories

**Full URL:** `GET /api/v1/reports/categories`  
**Access:** Private

**Description:** Get all active report categories.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success; `data` = array of categories.

**Errors:** 401 unauthorized.

---

## GET /reports/categories/with-subcategories

**Full URL:** `GET /api/v1/reports/categories/with-subcategories`  
**Access:** Private

**Description:** Get categories with their subcategories.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success; `data` = array of categories with subcategories.

**Errors:** 401 unauthorized.

---

## GET /reports/categories/:categoryId/subcategories

**Full URL:** `GET /api/v1/reports/categories/:categoryId/subcategories`  
**Access:** Private

**Description:** Get subcategories for a category.

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param      | Type   | Required | Notes           |
|------------|--------|----------|-----------------|
| categoryId | string | Yes      | 24-char ObjectId|

**Response (200):** Success; `data` = array of subcategories.

**Errors:** 400 invalid categoryId, 401 unauthorized.

---

# 20. Content Like

---

## POST /content-likes/toggle

**Full URL:** `POST /api/v1/content-likes/toggle`  
**Access:** Private

**Description:** Toggle like on content (like if not liked, unlike if liked).

**Headers:** `Authorization: Bearer <token>`

**Request body (JSON):**

| Field       | Type   | Required | Notes                    |
|------------|--------|----------|--------------------------|
| contentType| string | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string | Yes      | 24-char ObjectId         |

**Response (200):** Success; `data` = e.g. { isLiked: boolean, likeCount: number }.

**Errors:** 400 validation, 404 content not found, 401 unauthorized.

---

## GET /content-likes/:contentType/:contentId/status

**Full URL:** `GET /api/v1/content-likes/:contentType/:contentId/status`  
**Access:** Private

**Description:** Get like status for content (isLiked, likeCount).

**Headers:** `Authorization: Bearer <token>`

**Path parameters:**

| Param       | Type   | Required | Notes                    |
|------------|--------|----------|--------------------------|
| contentType| string | Yes      | `Post` \| `Write Post` \| `Zeal Post` |
| contentId  | string | Yes      | 24-char ObjectId         |

**Response (200):** Success; `data` = { isLiked, likeCount }.

**Errors:** 400 validation, 401 unauthorized.

---

# 21. Hashtags

---

## GET /hashtags/trending

**Full URL:** `GET /api/v1/hashtags/trending`  
**Access:** Public (optional auth)

**Description:** Get trending hashtags with content count.

**Query parameters:**

| Param | Type   | Required | Default | Notes        |
|-------|--------|----------|---------|--------------|
| limit | number | No       | 10      | Max 50       |

**Response (200):** Success; `data` = array of hashtags (tag, contentCount, etc.).

**Errors:** 400 if limit invalid.

---

# 22. Purchases (Verification)

---

## POST /purchases/verify/apple

**Full URL:** `POST /api/v1/purchases/verify/apple`  
**Access:** Private

**Description:** Verify Apple App Store purchase and grant verified badge.

**Headers:** `Authorization: Bearer <token>`

**Request body:** See `purchase-verification.validator.js` (e.g. receipt data).

**Response (200):** Success; `data` as per implementation.

**Errors:** 400 validation, 401 unauthorized.

---

## POST /purchases/verify/google

**Full URL:** `POST /api/v1/purchases/verify/google`  
**Access:** Private

**Description:** Verify Google Play purchase and grant verified badge.

**Headers:** `Authorization: Bearer <token>`

**Request body:** See validator (e.g. purchase token).

**Response (200):** Success; `data` as per implementation.

**Errors:** 400 validation, 401 unauthorized.

---

## POST /purchases/restore

**Full URL:** `POST /api/v1/purchases/restore`  
**Access:** Private

**Description:** Restore purchases.

**Headers:** `Authorization: Bearer <token>`

**Request body:** Per validator.

**Response (200):** Success.

**Errors:** 401 unauthorized.

---

## GET /purchases/status

**Full URL:** `GET /api/v1/purchases/status`  
**Access:** Private

**Description:** Get verified purchase status.

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Success; `data` = status object.

**Errors:** 401 unauthorized.

---

*End of per-API documentation. For Socket.IO events (chat, snaps), see CHAT_MODULE_FLOW_GUIDE or socket docs.*
