/**
 * Example Validator File
 * This shows how to create validators for your routes
 */

import { validateBody, validateQuery, validateParams, createSchema, commonValidations } from "../utils/validation.js";

/**
 * Example: Validate user creation
 * Only allows: name, email, password fields
 */
export const validateUserCreate = validateBody(
  createSchema(
    {
      name: commonValidations.stringRequired(1, 100),
      email: commonValidations.email,
      password: commonValidations.password,
    },
    ["name", "email", "password"] // Only these fields are allowed
  )
);

/**
 * Example: Validate user update
 * Only allows: name, bio fields
 */
export const validateUserUpdate = validateBody(
  createSchema(
    {
      name: commonValidations.stringOptional(1, 100),
      bio: commonValidations.stringOptional(0, 500),
    },
    ["name", "bio"] // Only these fields are allowed
  )
);

/**
 * Example: Validate query parameters
 */
export const validateGetUsers = validateQuery(
  createSchema({
    page: commonValidations.page,
    limit: commonValidations.limit,
    search: commonValidations.stringOptional(0, 100),
  })
);

/**
 * Example: Validate URL parameters
 */
export const validateUserId = validateParams(
  createSchema({
    id: commonValidations.objectId,
  })
);

