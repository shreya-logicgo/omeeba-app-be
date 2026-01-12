# Config Usage Guide

## Overview

Environment configuration is managed through `src/config/env.js` with Joi validation. The config is exported as a structured object that can be imported and used throughout the application.

## Import Methods

### Method 1: Import Default Config Object (Recommended)

```javascript
import config from "../config/env.js";

// Usage
const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

// Access nested properties
const dbUrl = config.mongodb.url;
const jwtSecret = config.jwt.secretKey;
const smtpHost = config.nodemailer.host;
```

### Method 2: Import Individual Variables (Backward Compatibility)

```javascript
import { PORT, MONGODB_URI, JWT_SECRET } from "../config/env.js";

// Usage
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Config Object Structure

```javascript
{
  port: 3000,
  nodeEnv: "development",
  apiVersion: "v1",
  mongodb: {
    url: "mongodb://localhost:27017/omeeba",
    testUrl: "mongodb://localhost:27017/omeeba_test",
    options: {}
  },
  jwt: {
    secretKey: "your-secret-key",
    expiresIn: "7d",
    refreshSecret: "your-refresh-secret",
    refreshExpiresIn: "30d"
  },
  bcrypt: {
    saltRounds: 12
  },
  fileUpload: {
    maxFileSize: 10485760,
    uploadPath: "./uploads"
  },
  cloudinary: {
    cloudName: "...",
    apiKey: "...",
    apiSecret: "..."
  },
  nodemailer: {
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      user: "...",
      pass: "..."
    }
  },
  email: {
    from: "noreply@omeeba.com"
  },
  cors: {
    origins: ["http://localhost:3000"]
  },
  logging: {
    level: "info",
    file: "./logs/app.log"
  },
  otp: {
    expireMinutes: 10,
    length: 6
  },
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100
  }
}
```

## Usage Examples

### Example 1: Server Configuration

```javascript
// src/server.js
import config from "./config/env.js";

const server = app.listen(config.port, () => {
  logger.info(
    `Server running in ${config.nodeEnv} mode on port ${config.port}`
  );
});
```

### Example 2: Database Connection

```javascript
// src/config/database.js
import config from "./env.js";

export const connectDB = async () => {
  const conn = await mongoose.connect(config.mongodb.url);
  // ...
};
```

### Example 3: JWT Authentication

```javascript
// src/middleware/auth.js
import config from "../config/env.js";

export const protect = async (req, res, next) => {
  const decoded = jwt.verify(token, config.jwt.secretKey);
  // ...
};
```

### Example 4: Email Configuration

```javascript
// src/services/email.service.js
import config from "../config/env.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: config.nodemailer.host,
  port: config.nodemailer.port,
  auth: config.nodemailer.auth,
});
```

### Example 5: Pagination

```javascript
// src/utils/pagination.js
import config from "../config/env.js";

export const getPagination = (req) => {
  const limit = Math.min(
    config.pagination.maxPageSize,
    parseInt(req.query.limit, 10) || config.pagination.defaultPageSize
  );
  // ...
};
```

## Environment Files

The config automatically loads the correct `.env` file based on `NODE_ENV`:

- **Development**: `.env.dev` (if exists) or `.env`
- **Production/Test/Staging**: `.env`

## Joi Validation

All environment variables are validated using Joi schema. If validation fails, the application will throw an error with clear messages about which variables are invalid.

## Benefits

1. **Type Safety**: Joi validation ensures correct types
2. **Structured Access**: Organized config object
3. **Clear Errors**: Validation errors show exactly what's wrong
4. **Environment Aware**: Automatically uses correct .env file
5. **Single Source**: All config in one place
