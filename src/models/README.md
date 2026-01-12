# Models Directory Structure

Models ko logical folders mein organize kiya gaya hai taaki filtering aur maintenance asaan ho.

## 📂 Folder Organization

### `users/` - User Related Models

- **User.js** - Main user model with authentication
- **UserFollower.js** - User follow relationships
- **UserAudience.js** - User audience relationships

### `content/` - Content Models

- **Post.js** - Regular image posts
- **WritePost.js** - Long-form written posts
- **ZealPost.js** - Video posts
- **Poll.js** - Polls with voting

### `comments/` - Comment Related Models

- **Comment.js** - Comments on content
- **CommentLike.js** - Comment likes
- **ReplyComment.js** - Reply to comments
- **ReplyCommentLike.js** - Reply comment likes

### `interactions/` - User Interaction Models

- **ContentLike.js** - Likes on posts/zeal/write_posts
- **ContentShare.js** - Content sharing between users
- **ContentReport.js** - Content reporting
- **SavedContent.js** - Saved content by users

### `music/` - Music Models

- **Music.js** - Music tracks

### `subscriptions/` - Subscription Models

- **SubscriptionPlan.js** - Subscription plans
- **UserSubscription.js** - User subscriptions
- **SubscriptionPayment.js** - Payment transactions

### `notifications/` - Notification Models

- **Notification.js** - User notifications

### `chat/` - Chat Models

- **ChatRoom.js** - Chat rooms between users
- **ChatMessage.js** - Chat messages

### Root Level

- **enums.js** - All enum definitions
- **index.js** - Central export file for all models

## 📦 Usage

Sabhi models ko `models/index.js` se import karein:

```javascript
const {
  // Users
  User,
  UserFollower,
  UserAudience,

  // Content
  Post,
  WritePost,
  ZealPost,
  Poll,

  // Comments
  Comment,
  CommentLike,
  ReplyComment,
  ReplyCommentLike,

  // Interactions
  ContentLike,
  ContentShare,
  ContentReport,
  SavedContent,

  // Music
  Music,

  // Subscriptions
  SubscriptionPlan,
  UserSubscription,
  SubscriptionPayment,

  // Notifications
  Notification,

  // Chat
  ChatRoom,
  ChatMessage,

  // Enums
  Enums,
} = require("./models");
```

## 🔍 Benefits of This Structure

1. **Better Organization** - Related models ek saath hain
2. **Easy Filtering** - Folder-wise models ko easily filter kar sakte hain
3. **Maintainability** - Code maintain karna asaan hai
4. **Scalability** - Naye models easily add kar sakte hain
5. **Clear Separation** - Different modules clearly separated hain
