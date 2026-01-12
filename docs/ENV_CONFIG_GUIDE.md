# Environment Variables Configuration Guide

## Overview

All environment variables are managed through a single centralized file: `src/config/env.js`

**IMPORTANT**: This is the ONLY file that should access `process.env` directly. All other files must import variables from this file.

## Central Configuration File

**Location**: `src/config/env.js`

This file:

- Loads environment variables from `.env` file
- Provides default values
- Exports all variables for use throughout the application
- Is the single source of truth for all environment configuration

## Usage

### Import Individual Variables

```javascript
// ✅ CORRECT - Import specific variables
import { PORT, MONGODB_URI, JWT_SECRET } from "../config/env.js";

// Use them
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Import All Variables

```javascript
// ✅ CORRECT - Import default config object
import config from "../config/env.js";

// Use them
const server = app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
```

### Import Multiple Variables

```javascript
// ✅ CORRECT - Import multiple variables
import {
  NODE_ENV,
  PORT,
  MONGODB_URI,
  JWT_SECRET,
  LOG_LEVEL,
} from "../config/env.js";
```

## ❌ DO NOT DO THIS

```javascript
// ❌ WRONG - Don't use process.env directly
const port = process.env.PORT;

// ❌ WRONG - Don't access process.env in other files
const dbUri = process.env.MONGODB_URI;
```

## Available Environment Variables

### Server Configuration

- `NODE_ENV` - Environment (development, production, test)
- `PORT` - Server port (default: 3000)
- `API_VERSION` - API version (default: v1)

### Database Configuration

- `MONGODB_URI` - MongoDB connection string
- `MONGODB_URI_TEST` - Test database connection string

### JWT Configuration

- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRE` - JWT expiration time (default: 7d)
- `JWT_REFRESH_SECRET` - Refresh token secret
- `JWT_REFRESH_EXPIRE` - Refresh token expiration (default: 30d)

### Bcrypt Configuration

- `BCRYPT_SALT_ROUNDS` - Salt rounds for password hashing (default: 12)

### File Upload Configuration

- `MAX_FILE_SIZE` - Maximum file size in bytes (default: 10MB)
- `UPLOAD_PATH` - Upload directory path (default: ./uploads)

### Cloudinary Configuration

- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

### Email Configuration

- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port (default: 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `FROM_EMAIL` - Default from email (default: noreply@omeeba.com)

### CORS Configuration

- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins

### Logging Configuration

- `LOG_LEVEL` - Log level (default: info)
- `LOG_FILE` - Log file path (default: ./logs/app.log)

### OTP Configuration

- `OTP_EXPIRE_MINUTES` - OTP expiration in minutes (default: 10)
- `OTP_LENGTH` - OTP length (default: 6)

### Pagination Configuration

- `DEFAULT_PAGE_SIZE` - Default page size (default: 20)
- `MAX_PAGE_SIZE` - Maximum page size (default: 100)

## Examples

### Example 1: Using in Server File

```javascript
// src/server.js
import app from "./app.js";
import { connectDB } from "./config/database.js";
import { PORT, NODE_ENV } from "./config/env.js";
import logger from "./utils/logger.js";

const server = app.listen(PORT, () => {
  logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});
```

### Example 2: Using in Middleware

```javascript
// src/middleware/auth.js
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

export const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.verify(token, JWT_SECRET);
  // ...
};
```

### Example 3: Using in Service

```javascript
// src/services/user.service.js
import User from "../models/users/User.js";
import bcrypt from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "../config/env.js";

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};
```

### Example 4: Using in Utils

```javascript
// src/utils/pagination.js
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../config/env.js";

export const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE)
  );
  return { page, limit, skip: (page - 1) * limit };
};
```

## Benefits

1. **Single Source of Truth**: All environment variables in one place
2. **Type Safety**: Default values ensure variables always have values
3. **Easy Testing**: Can mock the entire config object
4. **Better Organization**: Clear separation of concerns
5. **No Direct process.env**: Prevents accidental typos and undefined variables

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your environment variables
3. Import variables from `src/config/env.js` in your code
4. Never use `process.env` directly in other files

## Testing

For tests, use `MONGODB_URI_TEST` from env config:

```javascript
// tests/setup.js
import { connectDB } from "../src/config/database.js";
import { MONGODB_URI_TEST } from "../src/config/env.js";

// The database.js will automatically use MONGODB_URI_TEST in test environment
```
