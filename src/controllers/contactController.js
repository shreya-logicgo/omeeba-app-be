import { sendSuccess, sendBadRequest, sendError } from "../utils/response.js";
import logger from "../utils/logger.js";
import { processContactRequest, validateContactPayload } from "../services/contact.service.js";

export const submitContactRequest = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    const validation = validateContactPayload({ name, email, subject, message });
    if (!validation.valid) {
      return sendBadRequest(res, validation.message);
    }

    await processContactRequest({ name, email, subject, message });

    return sendSuccess(res, null, "Your request has been received. We will contact you shortly.");
  } catch (error) {
    logger.error("Contact API error", error);
    return sendError(res, "Internal server error", "Server Error", error.message, 500);
  }
};

export default { submitContactRequest };