// Validator exports
// This file exports all validators for easy importing

// Example usage:
// import { validateUserCreate, validateUserUpdate } from '../validators/user.validator.js';

export { validateBody, validateQuery, validateParams, commonValidations } from "../utils/validation.js";

// Example validator file structure:
// export const validateUserCreate = validateBody(
//   createSchema({
//     name: commonValidations.stringRequired(1, 100),
//     email: commonValidations.email,
//     password: commonValidations.password,
//   }, ['name', 'email', 'password']) // Only allow these fields
// );

export default {};
