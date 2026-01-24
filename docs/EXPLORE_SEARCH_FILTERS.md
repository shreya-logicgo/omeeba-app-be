# Explore Search Filters Documentation

## Overview
Search endpoint (`GET /api/v1/explore/search`) में `type` parameter के through filters लगते हैं।

## Filter Types & Model Keys

### 1. **Users Filter** (`type=users`)
**Model:** `User`
**Search Fields:**
- `name` - User का name (case-insensitive regex)
- `username` - User का username (case-insensitive regex)
- `bio` - User का bio (case-insensitive regex)

**Query Example:**
```javascript
{
  isDeleted: false,
  $or: [
    { name: { $regex: "searchTerm", $options: "i" } },
    { username: { $regex: "searchTerm", $options: "i" } },
    { bio: { $regex: "searchTerm", $options: "i" } }
  ]
}
```

**Sorting:**
- `popularity`: `followerCount` (descending)
- `recent`: `createdAt` (descending)

---

### 2. **Posts Filter** (`type=post`)
**Model:** `Post`
**Search Fields:**
- `caption` - Post का caption
  - Hashtag query: `caption` में regex search (`#hashtag\\b`)
  - Text query: MongoDB text index search

**Base Filters:**
- `userId` - Valid users में से (blocked users excluded)
- `_id` - Reported posts excluded

**Query Example:**
```javascript
{
  userId: { $in: validUserIds },
  // Hashtag search:
  caption: { $regex: "#hashtag\\b", $options: "i" }
  // OR Text search:
  $text: { $search: "searchTerm" }
}
```

---

### 3. **Write Posts Filter** (`type=write`)
**Model:** `WritePost`
**Search Fields:**
- `content` - Write post का content
  - Hashtag query: `content` में regex search (`#hashtag\\b`)
  - Text query: MongoDB text index search

**Base Filters:**
- `userId` - Valid users में से (blocked users excluded)
- `_id` - Reported write posts excluded

**Query Example:**
```javascript
{
  userId: { $in: validUserIds },
  // Hashtag search:
  content: { $regex: "#hashtag\\b", $options: "i" }
  // OR Text search:
  $text: { $search: "searchTerm" }
}
```

---

### 4. **Zeal Posts Filter** (`type=zeal`)
**Model:** `ZealPost`
**Search Fields:**
- `caption` - Zeal post का caption
  - Hashtag query: `caption` में regex search (`#hashtag\\b`)
  - Text query: MongoDB text index search

**Base Filters:**
- `userId` - Valid users में से (blocked users excluded)
- `status` - Only `PUBLISHED` या `READY` status
- `_id` - Reported zeal posts excluded

**Query Example:**
```javascript
{
  userId: { $in: validUserIds },
  status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
  // Hashtag search:
  caption: { $regex: "#hashtag\\b", $options: "i" }
  // OR Text search:
  $text: { $search: "searchTerm" }
}
```

---

### 5. **Polls Filter** (`type=polls`)
**Model:** `Poll`
**Search Fields:**
- `caption` - Poll का caption
  - Hashtag query: `caption` में regex search (`#hashtag\\b`)
  - Text query: MongoDB text index search

**Base Filters:**
- `createdBy` - Valid users में से (blocked users excluded)
- `status` - Only `ACTIVE` polls

**Query Example:**
```javascript
{
  createdBy: { $in: validUserIds },
  status: PollStatus.ACTIVE,
  // Hashtag search:
  caption: { $regex: "#hashtag\\b", $options: "i" }
  // OR Text search:
  $text: { $search: "searchTerm" }
}
```

**Sorting:**
- `popularity`: `totalVotes` (descending)
- `recent`: `createdAt` (descending)

---

### 6. **Content Filter** (`type=content`)
**Combines:** Posts + WritePosts + ZealPosts
- Same filters as individual content types
- All three content types को combine करके return करता है

---

### 7. **Hashtags Filter** (`type=hashtags`)
**Models:** `Post`, `WritePost`, `ZealPost`, `Poll`
**Search Fields:**
- `Post.caption`
- `WritePost.content`
- `ZealPost.caption`
- `Poll.caption`

**Process:**
1. सभी content types में hashtag search करता है
2. Hashtags extract करता है
3. Unique hashtags return करता है with usage count

**Query Example:**
```javascript
// Posts
{ userId: { $in: validUserIds }, caption: /#hashtag/i }

// WritePosts
{ userId: { $in: validUserIds }, content: /#hashtag/i }

// ZealPosts
{ userId: { $in: validUserIds }, status: [PUBLISHED, READY], caption: /#hashtag/i }

// Polls
{ createdBy: { $in: validUserIds }, status: ACTIVE, caption: /#hashtag/i }
```

---

### 8. **All Filter** (`type=all` - Default)
**Combines:** Content + Users + Polls + Hashtags
- सभी entity types को search करता है
- Results को separate arrays में return करता है

---

## Search Query Types

### 1. **Text Search** (Normal query)
- MongoDB text index use करता है
- Models में text indexes:
  - `Post.caption`
  - `WritePost.content`
  - `ZealPost.caption`
  - `Poll.caption`
  - `User.name`, `User.username`, `User.bio`

### 2. **Hashtag Search** (Query starts with `#`)
- Regex pattern use करता है: `#hashtag\\b`
- Case-insensitive search
- Word boundary (`\\b`) से exact hashtag match

---

## Common Base Filters (All Types)

### User Filtering:
- `isDeleted: false` - Deleted users excluded
- Blocked users excluded (if authenticated)

### Content Filtering:
- Reported content excluded (if authenticated)
- Only valid users का content

### Status Filtering:
- **ZealPosts:** Only `PUBLISHED` या `READY`
- **Polls:** Only `ACTIVE`

---

## API Usage Examples

### Search Users:
```
GET /api/v1/explore/search?query=john&type=users
```
**Searches in:** `User.name`, `User.username`, `User.bio`

### Search Posts:
```
GET /api/v1/explore/search?query=travel&type=post
```
**Searches in:** `Post.caption`

### Search Hashtags:
```
GET /api/v1/explore/search?query=#travel&type=hashtags
```
**Searches in:** All content types के caption/content fields

### Search All:
```
GET /api/v1/explore/search?query=test&type=all
```
**Searches in:** All entities (content, users, polls, hashtags)

---

## Summary Table

| Filter Type | Model | Search Fields | Base Filters |
|------------|-------|---------------|--------------|
| `users` | User | name, username, bio | isDeleted: false |
| `post` | Post | caption | userId (valid), exclude reported |
| `write` | WritePost | content | userId (valid), exclude reported |
| `zeal` | ZealPost | caption | userId (valid), status: PUBLISHED/READY, exclude reported |
| `polls` | Poll | caption | createdBy (valid), status: ACTIVE |
| `content` | Post, WritePost, ZealPost | caption/content | Same as individual types |
| `hashtags` | All content types | caption/content | Same as content types |
| `all` | All models | All fields | All base filters |

