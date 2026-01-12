# Omeeba Database Models

This directory contains all MongoDB models for the Omeeba social media platform, built with Mongoose.

## 📁 Project Structure

```
models/
├── enums.js                    # All enum definitions
├── index.js                    # Export all models
│
├── users/                      # User related models
│   ├── User.js                 # User model
│   ├── UserFollower.js         # User followers relationship
│   └── UserAudience.js         # User audience relationship
│
├── content/                    # Content models
│   ├── Post.js                 # Regular posts model
│   ├── WritePost.js            # Written posts model
│   ├── ZealPost.js             # Zeal (video) posts model
│   └── Poll.js                 # Polls model
│
├── comments/                   # Comment related models
│   ├── Comment.js              # Comments model
│   ├── CommentLike.js          # Comment likes
│   ├── ReplyComment.js         # Reply comments
│   └── ReplyCommentLike.js     # Reply comment likes
│
├── interactions/               # User interaction models
│   ├── ContentLike.js          # Content likes (posts/zeal/write_posts)
│   ├── ContentShare.js         # Content sharing
│   ├── ContentReport.js        # Content reporting
│   └── SavedContent.js         # Saved content
│
├── music/                      # Music models
│   └── Music.js                # Music tracks model
│
├── subscriptions/              # Subscription models
│   ├── SubscriptionPlan.js      # Subscription plans
│   ├── UserSubscription.js     # User subscriptions
│   └── SubscriptionPayment.js  # Payment transactions
│
├── notifications/              # Notification models
│   └── Notification.js         # Notifications
│
└── chat/                       # Chat models
    ├── ChatRoom.js             # Chat rooms
    └── ChatMessage.js          # Chat messages
```

## 🚀 Installation

```bash
npm install
```

## 📦 Dependencies

- **mongoose**: ^8.0.0 - MongoDB object modeling for Node.js

## 🔌 Database Connection

Create a database connection file:

```javascript
const { connectDB } = require("./config/database");
const mongoose = require("mongoose");

// Connect to MongoDB
connectDB("mongodb://localhost:27017/omeeba")
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((error) => {
    console.error("Database connection error:", error);
  });
```

## 📝 Usage Examples

### Import Models

```javascript
const { User, Post, Comment, ContentLike, Enums } = require("./models");
```

### Create a User

```javascript
const user = new User({
  email: "user@example.com",
  password: "hashedPassword",
  name: "John Doe",
  username: "johndoe",
  phoneNumber: 1234567890,
  countryCode: "+1",
});

await user.save();
```

### Create a Post

```javascript
const post = new Post({
  userId: user._id,
  caption: "My first post!",
  images: ["https://example.com/image.jpg"],
  musicId: music._id,
  musicStartTime: 10,
  musicEndTime: 30,
});

await post.save();
```

### Add a Comment

```javascript
const comment = new Comment({
  contentType: Enums.ContentType.POST,
  contentId: post._id,
  userId: user._id,
  comment: "Great post!",
});

await comment.save();
```

### Like Content

```javascript
const like = new ContentLike({
  contentType: Enums.ContentType.POST,
  contentId: post._id,
  userId: user._id,
});

await like.save();
```

### Populate References

```javascript
// Get post with user details
const post = await Post.findById(postId)
  .populate("userId", "name username profileImage")
  .populate("musicId")
  .populate("mentionedUserIds", "name username");

// Get comments with user details
const comments = await Comment.find({ contentId: postId })
  .populate("userId", "name username profileImage")
  .sort({ createdAt: -1 });
```

## 🔗 Model Relationships

### User Relationships

- `User` → `UserFollower` (userId, followerId)
- `User` → `UserAudience` (userId, audienceUserId)
- `User` → `Post` (userId)
- `User` → `ZealPost` (userId)
- `User` → `Comment` (userId)
- `User` → `ContentLike` (userId)
- `User` → `Notification` (receiverId, senderId)
- `User` → `ChatRoom` (userA, userB)
- `User` → `ChatMessage` (senderId)

### Content Relationships

- `Post` → `Music` (musicId)
- `ZealPost` → `Music` (musicId)
- `Comment` → `Post/ZealPost/WritePost` (contentId via contentTypeRef)
- `ContentLike` → `Post/ZealPost/WritePost` (contentId)
- `ContentShare` → `Post/ZealPost/WritePost` (contentId)

### Subscription Relationships

- `UserSubscription` → `User` (userId)
- `UserSubscription` → `SubscriptionPlan` (planId)
- `SubscriptionPayment` → `User` (userId)
- `SubscriptionPayment` → `UserSubscription` (subscriptionId)

## 📊 Enums

All enums are exported from `models/enums.js`:

- `ContentType`: post, write_post, zeal
- `ReportStatus`: pending, reviewed, resolved
- `PollStatus`: active, expired
- `SubscriptionStatus`: active, expired, cancelled, pending
- `BillingCycle`: monthly, quarterly, yearly
- `NotificationType`: post_comment, comment_reply, post_like, comment_like, follow
- `NotificationStatus`: unread, read
- `ChatType`: direct, request
- `MessageType`: text, image, snap, post, write_post, zeal
- `MessageStatus`: sent, delivered, seen

## 🔍 Indexes

All models include appropriate indexes for:

- Unique constraints (emails, usernames, etc.)
- Foreign key lookups
- Sorting and filtering operations
- Compound indexes for common query patterns

## ⚠️ Important Notes

1. **ObjectId References**: All foreign keys use `mongoose.Schema.Types.ObjectId` with proper `ref` attributes for population.

2. **Timestamps**: Most models include `createdAt` and `updatedAt` fields. Some use Mongoose's `timestamps: true` option.

3. **Unique Constraints**:

   - User email, username, phoneNumber
   - UserFollower (userId + followerId)
   - ContentLike (contentType + contentId + userId)
   - ChatRoom (userA + userB)

4. **Dynamic References**: The `Comment` model uses `refPath` to dynamically reference different content types (Post, ZealPost, WritePost).

5. **Array Fields**: Fields like `images`, `videos`, `mentionedUserIds` are stored as arrays.

## 🛠️ Development

To extend or modify models:

1. Update the schema in the respective model file
2. Update indexes if needed
3. Test the changes with sample data
4. Update this README if adding new models or relationships

## 📄 License

ISC
