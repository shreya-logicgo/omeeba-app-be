## Notifications – Technical Design

This document explains how the notification system works in the Omeeba backend: all notification types, when they are created, how they are stored, and how push notifications are sent with OneSignal.

---

## 1. Core Concepts

### 1.1 Notification entity

Notifications are stored in MongoDB via the `Notification` model

Key fields:

- **receiverId**: `ObjectId<User>`  
  User who receives the notification.

- **senderId**: `ObjectId<User>`  
  User who performed the action (like, comment, follow, etc.).

- **type**: `NotificationType`  
  String enum

- **contentType**: `ContentType | null`  
  Optional, one of: `"Post"`, `"Write Post"`, `"Zeal Post"`.

- **contentId**: `ObjectId | null`  
  Optional ID of the related post/zeal/write/etc.

- **message**: `string`  
  Human-readable message shown in the app.

- **status**: `NotificationStatus`  
  `"Unread"` or `"Read"`.

- **isAggregated**: `boolean`  
  Indicates if this notification aggregates multiple events of the same kind.

- **aggregatedCount**: `number`  
  Number of events combined in this aggregated notification.

- **aggregatedUserIds**: `ObjectId<User>[]`  
  Users whose actions are grouped into this notification.

- **metadata**: `Record<string, any>`  
  Free-form JSON, used for extra data (deep-links, flags, etc.).

- **createdAt / updatedAt**: `Date`  
  Timestamps (set by Mongoose).

---

### 1.2 Enums

- **ContentType**

  - `Post`
  - `Write Post`
  - `Zeal Post`

- **NotificationType**

  - **Follow & user activity**
    - `New Follower`
    - `Follow Request`
    - `Follow Request Accepted`

  - **Likes**
    - `Post Liked`
    - `Zeal Liked`
    - `Write Liked`
    - `Comment Liked`
    - `Aggregated Likes` (internal, used when multiple likes are grouped)

  - **Comments & replies**
    - `Post Comment`
    - `Zeal Comment`
    - `Write Comment`
    - `Comment Reply`
    - `Mention In Comment`

  - **Mentions**
    - `Mention In Post`
    - `Mention In Zeal`
    - `Mention In Write`

  - **Shares**
    - `Content Shared`
    - `Content Shared With You`

  - **Snaps**
    - `New Snap Received`
    - `Snap Viewed`

  - **Polls**
    - `Poll Voted`
    - `Poll Ended`

  - **System & account**
    - `Verified Badge Activated`
    - `Verified Badge Expired`
    - `Subscription Payment Success`

  - **Moderation & safety**
    - `Content Reported`
    - `Moderation Action`

- **NotificationStatus**

  - `Unread`
  - `Read`

---

## 2. End-to-end Flow

### 2.1 High-level flow

1. **User action occurs**  
   Examples:
   - User likes a post.
   - User comments or replies.
   - User follows someone.
   - User shares content.
   - User votes on a poll.
   - System event (badge activated/expired, subscription payment, moderation action).

2. **Domain service calls `createNotification`**  
   Services that call `createNotification`
   - `follow.service.js`
   - `comment.service.js`
   - `commentReply.service.js`
   - `content-like.service.js`
   - `content-share.service.js`
   - `poll.service.js`
   - `notification.controller.js` (for the generic `/notifications/send` endpoint)

   Usage example:

   ```js
   await createNotification({
     receiverId,
     senderId,
     type: NotificationType.POST_LIKED,
     contentType: ContentType.POST,
     contentId: postId,
     metadata: { /* optional */ },
   });
   ```

3. **Notification service handles creation & aggregation**

   - Validates `sender` and `receiver` exist and are not the same.
   - Generates a message string based on `type` and `contentType`.
   - If the `type` is aggregatable (likes, follows, comments, poll votes) it will:
     - Try to find an existing aggregated notification from the last 24h.
     - If found, it adds the new sender into `aggregatedUserIds` and updates `aggregatedCount` and `message`.
     - If not found, it creates a new aggregated notification.
   - If the `type` is not aggregatable, it creates a normal one-off notification.
   - It then triggers a **OneSignal push notification** asynchronously (non-blocking).

4. **Client consumes notifications**

   - In-app notification list:
     - `GET /api/v1/notifications`
   - Unread count:
     - `GET /api/v1/notifications/unread-count`
   - Mark as read:
     - `PUT /api/v1/notifications/:notificationId/read`
   - Mark all as read:
     - `PUT /api/v1/notifications/read-all`
   - Delete:
     - `DELETE /api/v1/notifications/:notificationId`

5. **Push notifications (OneSignal)**

   - Uses `oneSignalPlayerId` on the `User` model.
   - Uses `onesignal.service.js` to send:
     - to a single user,
     - to multiple player IDs,
     - or broadcast to all users.

---

## 3. Notification Types & Triggers

Below is a summary of each `NotificationType`, when it is used, and what it means.

### 3.1 Follow & user activity

- **`NEW_FOLLOWER`**
  - **Triggered when**: User A successfully starts following User B.
  - **Receiver**: User B.
  - **Message**: `"{senderName} started following you"`.

- **`FOLLOW_REQUEST`**
  - **Triggered when**: User A sends a follow request to a private account.
  - **Receiver**: The private account (User B).
  - **Message**: `"{senderName} sent you a follow request"`.

- **`FOLLOW_REQUEST_ACCEPTED`**
  - **Triggered when**: A follow request is accepted.
  - **Receiver**: The user who requested the follow.
  - **Message**: `"{senderName} accepted your follow request"`.

### 3.2 Likes

These are **aggregatable**.

- **`POST_LIKED`**, **`ZEAL_LIKED`**, **`WRITE_LIKED`**
  - **Triggered when**: Someone likes your post / zeal / write.
  - **Receiver**: Content owner.
  - **Message examples**:
    - `"{senderName} liked your post"`
    - `"{senderName} liked your zeal"`
    - `"{senderName} liked your write"`.

- **`COMMENT_LIKED`**
  - **Triggered when**: Someone likes your comment.
  - **Receiver**: Comment author.
  - **Message**: `"{senderName} liked your comment"`.

- **Aggregation behavior**
  - If multiple likes happen on the same content (same receiver, same contentType+contentId) within 24h, they are merged.
  - Example aggregated message:
    - `"{firstSenderName} and 3 others liked your post"`.

### 3.3 Comments & replies

- **`POST_COMMENT`**, **`ZEAL_COMMENT`**, **`WRITE_COMMENT`**
  - **Triggered when**: Someone comments on your post / zeal / write.
  - **Receiver**: Content owner.
  - **Messages**:
    - `"{senderName} commented on your post"`, etc.
  - Aggregatable (multiple commenters on same content).

- **`COMMENT_REPLY`**
  - **Triggered when**: Someone replies to your comment.
  - **Receiver**: Original comment author.
  - **Message**: `"{senderName} replied to your comment"`.

- **`MENTION_IN_COMMENT`**
  - **Triggered when**: A user is `@mentioned` inside a comment.
  - **Receiver**: Mentioned user.
  - **Message**: `"{senderName} mentioned you in a comment"`.

### 3.4 Mentions in content

- **`MENTION_IN_POST` / `MENTION_IN_ZEAL` / `MENTION_IN_WRITE`**
  - **Triggered when**: A user is `@mentioned` in the body of a post / zeal / write.
  - **Receiver**: Mentioned user.
  - **Messages**:
    - `"{senderName} mentioned you in a post"`, etc.

### 3.5 Shares

- **`CONTENT_SHARED`**
  - **Triggered when**: Someone shares your content (e.g. your post is reshared).
  - **Receiver**: Original content owner.
  - **Message**: `"{senderName} shared your post/zeal/write"`.

- **`CONTENT_SHARED_WITH_YOU`**
  - **Triggered when**: Someone shares a content item privately with you.
  - **Receiver**: The user with whom it is shared.
  - **Message**: `"{senderName} shared a post/zeal/write with you"`.

### 3.6 Snaps

- **`NEW_SNAP_RECEIVED`**
  - **Triggered when**: You receive a snap from another user.
  - **Receiver**: Snap recipient.
  - **Message**: `"{senderName} sent you a snap"`.

- **`SNAP_VIEWED`**
  - **Triggered when**: Someone views your snap.
  - **Receiver**: Snap sender.
  - **Message**: `"{senderName} viewed your snap"`.

### 3.7 Polls

- **`POLL_VOTED`**
  - **Triggered when**: A user votes on your poll.
  - **Receiver**: Poll owner.
  - **Message**: `"{senderName} voted on your poll"` (aggregatable).

- **`POLL_ENDED`**
  - **Triggered when**: A poll is ended (e.g. via cron job).
  - **Receiver**: Poll owner.
  - **Message**: `"Your poll has ended"`.

### 3.8 System & account

- **`VERIFIED_BADGE_ACTIVATED`**
  - **Triggered when**: Verified badge is activated after successful payment/verification.
  - **Receiver**: The user whose badge is activated.
  - **Message**: `"Your verified badge has been activated"`.

- **`VERIFIED_BADGE_EXPIRED`**
  - **Triggered when**: Verified badge subscription expires (cron job).
  - **Receiver**: The user whose badge expired.
  - **Message**: `"Your verified badge has expired"`.

- **`SUBSCRIPTION_PAYMENT_SUCCESS`**
  - **Triggered when**: A subscription payment is successfully processed.
  - **Receiver**: Subscriber.
  - **Message**: `"Your subscription payment was successful"`.

### 3.9 Moderation & safety

- **`CONTENT_REPORTED`**
  - **Triggered when**: A user’s content is reported.
  - **Receiver**: Content owner.
  - **Message**: `"Your content has been reported"`.

- **`MODERATION_ACTION`**
  - **Triggered when**: Moderators take an action on a user’s content (e.g. removal).
  - **Receiver**: Content owner (or affected user).
  - **Message**: `"Moderation action has been taken on your content"`.

---

## 4. Aggregation Logic

Some notification types are **aggregated** to reduce spam:

- Aggregatable types:
  - `Post Liked`, `Zeal Liked`, `Write Liked`
  - `Comment Liked`
  - `New Follower`
  - `Post Comment`, `Zeal Comment`, `Write Comment`
  - `Poll Voted`

**Rules:**

- **Grouping key**:  
  `aggregationKey = type : receiverId : (contentType?) : (contentId?)`
- **Time window**:  
  Only notifications created in the last 24 hours are considered for aggregation.
- **Behavior**:
  1. On new event, check if an aggregated notification already exists with same key and within 24h.
  2. If yes:
     - Add `senderId` to `aggregatedUserIds` (if not already there).
     - Increase `aggregatedCount`.
     - Regenerate `message` using `generateAggregatedMessage`.
  3. If no:
     - Create a new notification with:
       - `isAggregated = true`
       - `aggregatedCount = 1`
       - `aggregatedUserIds = [senderId]`.

---

## 5. Push Notifications (OneSignal)

### 5.1 User fields

On `User` model

- `oneSignalPlayerId: string | null`  
- `pushNotificationEnabled: boolean` (default `true`)

Notification payload example:

```js
{
  title: "Omeeba" or senderName,
  body: "<notification message>",
  imageUrl: "<optional image URL>",
}
```

`data` is always an object of stringifiable values (for deep links, metadata, etc.).

### 5.3 Integration with notification service

`notification.service` uses `sendPushNotificationAsync`:

- Builds payload:
  - `title`: sender name or username or `"Omeeba"`.
  - `body`: same message stored in the `Notification` document.
  - `imageUrl`: sender’s profile image (optional).
- `data` includes:
  - `notificationId`
  - `type`
  - `contentType`
  - `contentId`
  - `isAggregated`, `aggregatedCount` (when applicable)
  - Any additional `metadata`

Push sending is **non-blocking**:
- Errors are logged, but they do not affect the main API response that created the notification.

---

## 6. Public Notification APIs

### 6.1 List notifications

- **Method**: `GET`
- **URL**: `/api/v1/notifications`
- **Auth**: Private (JWT)
- **Query params**:
  - `status`: `all` | `unread` | `read` (optional, default `all`)
  - `type`: `NotificationType` string (optional)
  - `page`: number (default `1`)
  - `limit`: number (default `20`, max `100`)

**Response example:**

```json
{
  "success": true,
  "data": [
    {
      "id": "notificationId",
      "type": "Post Liked",
      "message": "Alice liked your post",
      "status": "Unread",
      "contentType": "Post",
      "contentId": "postId",
      "sender": {
        "id": "senderId",
        "name": "Alice",
        "username": "alice",
        "profileImage": "https://...",
        "isAccountVerified": true,
        "isVerifiedBadge": false
      },
      "isAggregated": true,
      "aggregatedCount": 4,
      "aggregatedUsers": [],
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T01:00:00.000Z"
    }
  ],
  "pagination": {}
}
```

---

### 6.2 Get unread count

- **Method**: `GET`
- **URL**: `/api/v1/notifications/unread-count`
- **Response**:

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

### 6.3 Mark one as read

- **Method**: `PUT`
- **URL**: `/api/v1/notifications/:notificationId/read`

Marks a single notification as `Read`.

---

### 6.4 Mark all as read

- **Method**: `PUT`
- **URL**: `/api/v1/notifications/read-all`

Marks **all** of the current user’s notifications as `Read`.

---

### 6.5 Delete notification

- **Method**: `DELETE`
- **URL**: `/api/v1/notifications/:notificationId`

Deletes a single notification for the current user.

---

### 6.6 Manage OneSignal player ID

- **Register or update player ID**

  - **Method**: `POST`
  - **URL**: `/api/v1/notifications/player-id`
  - **Body**:

    ```json
    {
      "playerId": "<OneSignal player ID>"
    }
    ```

- **Get player ID & push settings**

  - **Method**: `GET`
  - **URL**: `/api/v1/notifications/player-id`

- **Remove player ID**

  - **Method**: `DELETE`
  - **URL**: `/api/v1/notifications/player-id`

- **Toggle push notifications**

  - **Method**: `PUT`
  - **URL**: `/api/v1/notifications/push-settings`
  - **Body**:

    ```json
    {
      "enabled": true
    }
    ```

---

### 6.7 Generic “create & send” API

- **Method**: `POST`
- **URL**: `/api/v1/notifications/send`
- **Auth**: Private (intended for internal/admin usage)

**Body fields:**

- `receiverId`: user ID (optional if using `playerIds` or `sendToAll`)
- `playerIds`: `string[]` of OneSignal player IDs (optional)
- `sendToAll`: `boolean` (optional)
- `type`: optional `NotificationType`
- `contentType`: optional `ContentType`
- `contentId`: optional `ObjectId` string
- `message`: optional custom message (if omitted, it may not auto-generate)
- `title`: optional push notification title
- `metadata`: optional object for extra payload

**Behavior:**

- If `receiverId` provided:
  - Creates a `Notification` entry via `createNotification`.
  - Sends push to that user (if `oneSignalPlayerId` is present).
- If `playerIds` provided:
  - Sends push directly to those OneSignal player IDs.
- If `sendToAll === true`:
  - Sends a broadcast push to all users via OneSignal segments.

---


