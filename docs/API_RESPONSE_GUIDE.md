# API Response Guide

## Response Functions

All response functions are available in `src/utils/response.js` and can be imported in your routes.

## Success Response

```javascript
import { sendSuccess } from "../utils/response.js";

// Basic success response
sendSuccess(res, data, "Product FAQs retrieved");

// With custom status code
sendSuccess(res, data, "User created successfully", 201);
```

**Response Format:**
```json
{
  "success": true,
  "message": "Product FAQs retrieved",
  "data": []
}
```

## Error Response

```javascript
import { sendError } from "../utils/response.js";

// Basic error response
sendError(res, "Internal Server Error", "Server Error", "Internal Server Error", 500);

// Predefined error helpers
import { sendNotFound, sendUnauthorized, sendForbidden, sendBadRequest } from "../utils/response.js";

sendNotFound(res, "User not found");
sendUnauthorized(res, "Invalid credentials");
sendForbidden(res, "Access denied");
sendBadRequest(res, "Invalid request data");
```

**Response Format:**
```json
{
  "success": false,
  "message": "Internal Server Error",
  "errorType": "Server Error",
  "error": "Internal Server Error",
  "data": null
}
```

## Validation Error Response

```javascript
import { sendValidationError } from "../utils/response.js";

sendValidationError(res, "Product ID is required");
```

**Response Format:**
```json
{
  "success": false,
  "message": "Validation error",
  "errorType": "Validation Error",
  "error": "Product ID is required",
  "data": null
}
```

## Paginated Response

```javascript
import { sendPaginated } from "../utils/response.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";

// In your route
const { page, limit, skip } = getPagination(req);
const data = await fetchData(skip, limit);
const total = await getTotalCount();

const pagination = getPaginationMeta(total, page, limit);
sendPaginated(res, data, pagination, "Product FAQs retrieved");
```

**Response Format:**
```json
{
  "success": true,
  "message": "Product FAQs retrieved",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

## Joi Validation

### Basic Usage

```javascript
import { validateBody, createSchema, commonValidations } from "../validators/index.js";

// Create validator
export const validateUserCreate = validateBody(
  createSchema({
    name: commonValidations.stringRequired(1, 100),
    email: commonValidations.email,
    password: commonValidations.password,
  }, ['name', 'email', 'password']) // Only allow these fields
);

// Use in route
router.post("/", validateUserCreate, async (req, res) => {
  // req.body is validated and sanitized
  sendSuccess(res, req.body, "User created");
});
```

### Field Restrictions

To only allow specific fields, pass them as second parameter to `createSchema`:

```javascript
// Only allows: name, email, password
// All other fields will be rejected
export const validateUserCreate = validateBody(
  createSchema({
    name: commonValidations.stringRequired(1, 100),
    email: commonValidations.email,
    password: commonValidations.password,
  }, ['name', 'email', 'password'])
);
```

### Common Validations

Available in `commonValidations`:

```javascript
// ObjectId
commonValidations.objectId
commonValidations.objectIdOptional

// Email
commonValidations.email

// Password
commonValidations.password

// String
commonValidations.stringRequired(min, max)
commonValidations.stringOptional(min, max)

// Number
commonValidations.numberRequired(min, max)
commonValidations.numberOptional(min, max)

// Boolean
commonValidations.boolean
commonValidations.booleanRequired

// Array
commonValidations.arrayRequired(itemSchema)
commonValidations.arrayOptional(itemSchema)

// Date
commonValidations.date
commonValidations.dateRequired

// Pagination
commonValidations.page
commonValidations.limit
```

### Validate Query Parameters

```javascript
import { validateQuery } from "../validators/index.js";

export const validateGetUsers = validateQuery(
  createSchema({
    page: commonValidations.page,
    limit: commonValidations.limit,
    search: commonValidations.stringOptional(0, 100),
  })
);
```

### Validate URL Parameters

```javascript
import { validateParams } from "../validators/index.js";

export const validateUserId = validateParams(
  createSchema({
    id: commonValidations.objectId,
  })
);
```

## Complete Route Example

```javascript
import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody, validateQuery, validateParams, createSchema, commonValidations } from "../validators/index.js";
import { sendSuccess, sendError, sendPaginated, sendNotFound } from "../utils/response.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";

const router = express.Router();

// Validators
const validateCreate = validateBody(
  createSchema({
    title: commonValidations.stringRequired(1, 200),
    content: commonValidations.stringRequired(1, 1000),
  }, ['title', 'content'])
);

const validateGetAll = validateQuery(
  createSchema({
    page: commonValidations.page,
    limit: commonValidations.limit,
  })
);

const validateGetOne = validateParams(
  createSchema({
    id: commonValidations.objectId,
  })
);

// Routes
router.post("/", protect, validateCreate, async (req, res) => {
  try {
    const data = await createItem(req.body);
    sendSuccess(res, data, "Item created successfully", 201);
  } catch (error) {
    sendError(res, "Failed to create item", "Server Error", error.message, 500);
  }
});

router.get("/", validateGetAll, async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const data = await getItems(skip, limit);
    const total = await getTotalCount();
    
    const pagination = getPaginationMeta(total, page, limit);
    sendPaginated(res, data, pagination, "Items retrieved successfully");
  } catch (error) {
    sendError(res, "Failed to fetch items", "Server Error", error.message, 500);
  }
});

router.get("/:id", validateGetOne, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getItemById(id);
    
    if (!data) {
      return sendNotFound(res, "Item not found");
    }
    
    sendSuccess(res, data, "Item retrieved successfully");
  } catch (error) {
    sendError(res, "Failed to fetch item", "Server Error", error.message, 500);
  }
});

export default router;
```

## Error Handling

All errors are automatically caught and formatted by the error handler middleware. Joi validation errors are automatically formatted with clear messages.

**Validation Error Example:**
```json
{
  "success": false,
  "message": "Validation error",
  "errorType": "Validation Error",
  "error": "Email must be a valid email",
  "data": null
}
```

