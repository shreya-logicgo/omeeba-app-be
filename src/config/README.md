# Configuration Files

## Environment Variables (`env.js`)

**This is the ONLY file that should access `process.env` directly.**

All environment variables are centralized in `src/config/env.js`. All other files must import variables from this file.

### Usage

```javascript
// ✅ CORRECT - Import from env.js
import { PORT, MONGODB_URI, JWT_SECRET } from "../config/env.js";

// ❌ WRONG - Don't use process.env directly
const port = process.env.PORT;
```

### Available Variables

See `docs/ENV_CONFIG_GUIDE.md` for complete list of available environment variables.

## Database Configuration (`database.js`)

Handles MongoDB connection using variables from `env.js`.

### Usage

```javascript
import { connectDB, disconnectDB } from "./config/database.js";

await connectDB();
// ... your code
await disconnectDB();
```

The database connection automatically uses `MONGODB_URI` from `env.js`. In test environment, it uses `MONGODB_URI_TEST`.
