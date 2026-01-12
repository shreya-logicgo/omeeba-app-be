# Content Helper Utilities

## Overview

Ye utilities polymorphic content references ko manage karne ke liye hain. Jab aapko `contentId` se 3 different models (Post, WritePost, ZealPost) ko reference karna ho.

## Solution

### 1. **refPath Approach** (Recommended)

Mongoose mein `refPath` use karke dynamic references handle karte hain:

```javascript
contentId: {
  type: mongoose.Schema.Types.ObjectId,
  required: true,
  refPath: "contentTypeRef",  // Dynamic reference
},
contentTypeRef: {
  type: String,
  enum: Object.values(ContentModelName), // ["Post", "WritePost", "ZealPost"]
  required: false, // Auto-set by pre-save hook
}
```

### 2. **Automatic Mapping**

Pre-save hook automatically `contentTypeRef` set karta hai:

```javascript
// Pre-save hook
schema.pre("save", function (next) {
  if (this.contentType && !this.contentTypeRef) {
    this.contentTypeRef = ContentTypeToModelName[this.contentType];
  }
  next();
});
```

## Usage Examples

### Import Helper Functions

```javascript
import {
  getContentModel,
  getContentModelName,
  populateContent,
  validateContentExists,
} from "./models/utils/contentHelper.js";
```

### Get Model by ContentType

```javascript
const Model = getContentModel(ContentType.POST);
// Returns: Post model

const model = getContentModel(ContentType.WRITE_POST);
// Returns: WritePost model
```

### Populate Content

```javascript
const comment = await Comment.findById(commentId);
const content = await populateContent(comment);
// Returns: Populated Post/WritePost/ZealPost document
```

### Validate Content Exists

```javascript
const exists = await validateContentExists(ContentType.POST, contentId);
// Returns: true/false
```

## Models Updated

1. **Comment** - Uses refPath with virtual for population
2. **ContentLike** - Uses refPath for dynamic reference
3. **ContentShare** - Uses refPath for dynamic reference
4. **ContentReport** - Uses refPath for dynamic reference
5. **ChatMessage** - Uses refPath (optional contentId)

## Benefits

✅ **Type Safety** - Enum-based validation
✅ **Automatic Mapping** - Pre-save hooks handle conversion
✅ **Easy Population** - refPath se easy population
✅ **Centralized** - Sab kuch enums.js mein manage
✅ **Flexible** - Helper functions se easy access

## Comparison

### ❌ Simple Approach (Not Recommended)

```javascript
contentId: {
  type: mongoose.Schema.Types.ObjectId,
  default: null,
}
// Problem: No automatic population, manual model selection needed
```

### ✅ refPath Approach (Recommended)

```javascript
contentId: {
  type: mongoose.Schema.Types.ObjectId,
  refPath: "contentTypeRef",
}
// Benefit: Automatic population, type-safe, centralized
```
