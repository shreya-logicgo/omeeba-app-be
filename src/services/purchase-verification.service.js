import https from "https";
import { URL } from "url";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import fs from "fs";
import path from "path";
import SubscriptionPlan from "../models/subscriptions/SubscriptionPlan.js";
import SubscriptionPayment from "../models/subscriptions/SubscriptionPayment.js";
import UserSubscription from "../models/subscriptions/UserSubscription.js";
import User from "../models/users/User.js";
import { SubscriptionStatus, BillingCycle } from "../models/enums.js";
import { PAYMENT_PROVIDERS } from "../constants/index.js";
import logger from "../utils/logger.js";
import config from "../config/env.js";

/**
 * Get user by Google Play subscription
 * @param {string} subscriptionId - Google Play subscription ID
 * @param {string} purchaseToken - Purchase token
 * @returns {Promise<Object|null>} User object or null
 */
export const getUserByGoogleSubscription = async (subscriptionId, purchaseToken) => {
  try {
    // Find user subscription by subscription ID and purchase token
    const userSubscription = await UserSubscription.findOne({
      productId: subscriptionId,
      $or: [
        { latestReceiptData: purchaseToken },
        { originalTransactionId: { $regex: subscriptionId } }
      ]
    }).populate('userId');

    if (!userSubscription || !userSubscription.userId) {
      return null;
    }

    return userSubscription.userId;
  } catch (error) {
    logger.error('Error finding user by Google subscription:', error);
    return null;
  }
};

/**
 * Initialize Google Auth using file-based credentials
 * @returns {Promise<GoogleAuth>} Google Auth client
 * @throws {Error} If key file is missing or invalid
 */
export const initializeGoogleAuth = async () => {
  try {
    const keyFilePath = path.join(process.cwd(), 'config', 'google-service-account.json');
    
    // Check if key file exists
    if (!fs.existsSync(keyFilePath)) {
      const error = new Error(`Google service account key file not found: ${keyFilePath}`);
      error.errorType = "AUTH_ERROR";
      error.debugStep = "key_file_check";
      error.fix = "Place your Google service account JSON file at config/google-service-account.json";
      throw error;
    }
    
    // DEBUG: Safe runtime diagnostics
    logger.info("DEBUG: Google Auth runtime diagnostics:", {
      processCwd: process.cwd(),
      keyFilePath: keyFilePath,
      fileExists: fs.existsSync(keyFilePath)
    });
    
    // TEMP: Validate JSON parsing before GoogleAuth
    try {
      const validationContent = fs.readFileSync(keyFilePath, 'utf8');
      const parsedValidation = JSON.parse(validationContent);
      logger.info("TEMP: JSON validation successful:", {
        success: true,
        clientEmail: parsedValidation.client_email,
        hasType: !!parsedValidation.type,
        hasPrivateKey: !!parsedValidation.private_key,
        hasProjectId: !!parsedValidation.project_id
      });
    } catch (validationError) {
      logger.error("TEMP: JSON validation failed:", {
        success: false,
        error: validationError.message,
        stack: validationError.stack
      });
      throw new Error(`JSON validation failed: ${validationError.message}`);
    }
    
    // Read file manually to check encoding and content
    let fileContent;
    try {
      fileContent = fs.readFileSync(keyFilePath, "utf8");
      logger.info("DEBUG: File reading successful:", {
        fileSize: fileContent.length,
        contentPreview: fileContent.substring(0, 80) + (fileContent.length > 80 ? "..." : "")
      });
    } catch (readError) {
      const error = new Error(`Failed to read Google service account file: ${readError.message}`);
      error.errorType = "AUTH_ERROR";
      error.debugStep = "file_read_error";
      error.fix = "Check file permissions and encoding";
      throw error;
    }
    
    // Validate JSON content
    let parsedContent;
    try {
      parsedContent = JSON.parse(fileContent);
      logger.info("DEBUG: JSON parsing successful:", {
        hasClientEmail: !!parsedContent.client_email,
        clientEmail: parsedContent.client_email
      });
    } catch (parseError) {
      const error = new Error("Invalid Google service account JSON file. File may be corrupted, wrong encoding, or different from expected runtime file.");
      error.errorType = "AUTH_ERROR";
      error.debugStep = "json_parse_error";
      error.originalError = parseError;
      error.fix = "Ensure file is valid UTF-8 JSON and matches expected service account format";
      throw error;
    }
    
    logger.info("Initializing Google Auth using file-based credentials");
    logger.info(`Key file path: ${keyFilePath}`);
    
    const auth = new GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    
    logger.info("Google Auth initialized successfully using file-based credentials");
    
    return auth;
  } catch (error) {
    logger.error("Failed to initialize Google Auth:", {
      error: error.message,
      debugStep: error.debugStep || "auth_initialization",
      keyFilePath: path.join(process.cwd(), 'config', 'google-service-account.json')
    });
    
    const enhancedError = new Error(`Google authentication failed using file-based credentials: ${error.message}`);
    enhancedError.errorType = error.errorType || "AUTH_ERROR";
    enhancedError.debugStep = error.debugStep || "auth_initialization";
    enhancedError.originalError = error;
    enhancedError.fix = error.fix || "Ensure config/google-service-account.json exists and is readable";
    throw enhancedError;
  }
};




/**
 * Verify StoreKit 2 receipt using local JWT verification
 * @param {string} receiptData - StoreKit 2 transaction data (JSON with signed tokens)
 * @returns {Promise<Object>} Verified receipt data
 */
const verifyStoreKit2WithAppleServer = async (receiptData) => {
  try {
    logger.info("Verifying StoreKit 2 receipt...");
    logger.info(`Receipt data preview: ${receiptData.substring(0, 100)}...`);

    // Simple approach: Try to decode as JWT directly first
    try {
      const decoded = jwt.decode(receiptData, { complete: false });
      if (decoded && decoded.transactionId && decoded.productId) {
        logger.info("Direct JWT transaction token detected");
        return {
          status: 0,
          environment: decoded.environment?.toLowerCase() || "sandbox",
          receipt: {
            in_app: [
              {
                product_id: decoded.productId,
                transaction_id: decoded.transactionId,
                original_transaction_id: decoded.originalTransactionId,
                purchase_date_ms: decoded.purchaseDate,
                expires_date_ms: decoded.expiresDate,
                quantity: decoded.quantity || 1,
                web_order_line_item_id: decoded.webOrderLineItemId,
              },
            ],
          },
          latest_receipt_info: [
            {
              product_id: decoded.productId,
              transaction_id: decoded.transactionId,
              original_transaction_id: decoded.originalTransactionId,
              purchase_date_ms: decoded.purchaseDate,
              expires_date_ms: decoded.expiresDate,
              quantity: decoded.quantity || 1,
              web_order_line_item_id: decoded.webOrderLineItemId,
            },
          ],
        };
      }
    } catch (jwtError) {
      logger.info("Not a direct JWT, trying JSON format");
    }

    // Try to parse as JSON directly (most common format for StoreKit 2)
    let parsedData;
    try {
      parsedData = JSON.parse(receiptData);
      logger.info("Parsed as direct JSON");
    } catch (jsonError) {
      logger.info("Not direct JSON, trying base64 decode");

      // Try base64 decode
      try {
        const decoded = Buffer.from(receiptData, "base64").toString("utf8");
        parsedData = JSON.parse(decoded);
        logger.info("Parsed as base64 decoded JSON");
      } catch (base64Error) {
        logger.error("All parsing methods failed");
        throw new Error(`Invalid receipt format: ${base64Error.message}`);
      }
    }

    logger.info("Successfully parsed receipt structure");
    logger.info("Available keys:", Object.keys(parsedData));

    // Extract and verify the first transaction
    let transactionToken;
    if (
      parsedData.signedTransactions &&
      Array.isArray(parsedData.signedTransactions) &&
      parsedData.signedTransactions.length > 0
    ) {
      transactionToken = parsedData.signedTransactions[0];
      logger.info("Using signedTransactions[0]");
    } else if (parsedData.signedRenewalInfo) {
      transactionToken = parsedData.signedRenewalInfo;
      logger.info("Using signedRenewalInfo");
    } else {
      throw new Error("No transaction found in receipt data");
    }

    // Decode JWT without verification to get transaction info
    const decoded = jwt.decode(transactionToken, { complete: false });

    if (!decoded || !decoded.transactionId || !decoded.productId) {
      throw new Error("Invalid transaction data in JWT");
    }

    logger.info("Transaction decoded successfully:", {
      transactionId: decoded.transactionId,
      productId: decoded.productId,
      bundleId: decoded.bundleId,
      environment: decoded.environment,
    });

    // Return in the same format as Apple verifyReceipt endpoint
    return {
      status: 0,
      environment: decoded.environment?.toLowerCase() || "sandbox",
      receipt: {
        in_app: [
          {
            product_id: decoded.productId,
            transaction_id: decoded.transactionId,
            original_transaction_id: decoded.originalTransactionId,
            purchase_date_ms: decoded.purchaseDate,
            expires_date_ms: decoded.expiresDate,
            quantity: decoded.quantity || 1,
            web_order_line_item_id: decoded.webOrderLineItemId,
          },
        ],
      },
      latest_receipt_info: [
        {
          product_id: decoded.productId,
          transaction_id: decoded.transactionId,
          original_transaction_id: decoded.originalTransactionId,
          purchase_date_ms: decoded.purchaseDate,
          expires_date_ms: decoded.expiresDate,
          quantity: decoded.quantity || 1,
          web_order_line_item_id: decoded.webOrderLineItemId,
        },
      ],
    };
  } catch (error) {
    logger.error("StoreKit 2 verification failed:", error.message);
    throw new Error(`Receipt verification failed: ${error.message}`);
  }
};

/**
 * Verify StoreKit 2 JWT receipt (Local verification - kept for backup)
 * @param {string} jwtToken - JWT token from StoreKit 2
 * @returns {Promise<Object>} Verified transaction data
 */
const verifyStoreKit2Receipt = async (jwtToken) => {
  try {
    logger.info("Verifying StoreKit 2 JWT receipt...");
    logger.info(`Receipt data preview: ${jwtToken.substring(0, 100)}...`);

    // Check if the input is a JSON string containing multiple tokens
    let actualToken = jwtToken;

    // Try to parse as JSON first (for nested token structure)
    if (jwtToken.startsWith("{") && jwtToken.endsWith("}")) {
      try {
        const parsedData = JSON.parse(jwtToken);
        logger.info("Successfully parsed JSON structure");
        logger.info("Available keys:", Object.keys(parsedData));

        // Extract the actual signed transaction token from the nested structure
        if (
          parsedData.signedTransactions &&
          Array.isArray(parsedData.signedTransactions) &&
          parsedData.signedTransactions.length > 0
        ) {
          actualToken = parsedData.signedTransactions[0];
          logger.info("Using signedTransactions[0] token");
        } else if (parsedData.signedRenewalInfo) {
          actualToken = parsedData.signedRenewalInfo;
          logger.info("Using signedRenewalInfo token");
        } else {
          // Try to find any property that contains a JWT token
          const jwtKeys = Object.keys(parsedData).filter((key) => {
            const value = parsedData[key];
            return typeof value === "string" && value.startsWith("eyJ");
          });

          if (jwtKeys.length > 0) {
            actualToken = parsedData[jwtKeys[0]];
            logger.info(`Using JWT token from key: ${jwtKeys[0]}`);
          } else {
            throw new Error(
              `No valid JWT token found in nested structure. Available keys: ${Object.keys(parsedData)}`
            );
          }
        }
        logger.info("Extracted token from nested JSON structure");
      } catch (parseError) {
        // If parsing fails, treat as direct JWT token
        logger.info(
          `JSON parsing failed: ${parseError.message}, treating as direct JWT`
        );
      }
    }

    logger.info(`Final token preview: ${actualToken.substring(0, 100)}...`);

    // Ensure the token is a valid JWT format
    if (
      !actualToken ||
      typeof actualToken !== "string" ||
      !actualToken.includes(".")
    ) {
      throw new Error(
        "Invalid JWT token format - token must be a string with dots"
      );
    }

    // Decode JWT without verification first to get header
    const decoded = jwt.decode(actualToken, { complete: true });

    if (!decoded || !decoded.header || !decoded.header.kid) {
      logger.error("JWT decode result:", decoded);
      throw new Error("Invalid JWT token format - missing header or kid");
    }

    const kid = decoded.header.kid;
    logger.info(`JWT Key ID: ${kid}`);

    // Get Apple's public key
    const client = jwksClient({
      jwksUri: "https://api.storekit.itunes.apple.com/.well-known/jwks",
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    });

    // Get signing key
    const key = await new Promise((resolve, reject) => {
      client.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(err);
        } else {
          resolve(key);
        }
      });
    });

    // Verify JWT
    const verified = jwt.verify(actualToken, key.getPublicKey(), {
      algorithms: ["ES256"],
    });

    logger.info("JWT verification successful");

    // Extract transaction information
    const transactionData = {
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      productId: verified.productId,
      purchaseDate: new Date(verified.purchaseDate),
      expiresDate: verified.expiresDate ? new Date(verified.expiresDate) : null,
      environment: verified.environment,
      type: verified.type,
      signedDate: new Date(verified.signedDate),
      webOrderLineItemId: verified.webOrderLineItemId,
      quantity: verified.quantity,
      bundleId: verified.bundleId,
      appAccountToken: verified.appAccountToken,
    };

    logger.info(
      `Transaction verified: ${transactionData.productId}, Environment: ${transactionData.environment}`
    );

    return {
      status: 0,
      environment: transactionData.environment.toLowerCase(),
      receipt: {
        in_app: [
          {
            product_id: transactionData.productId,
            transaction_id: transactionData.transactionId,
            original_transaction_id: transactionData.originalTransactionId,
            purchase_date_ms: transactionData.purchaseDate.getTime(),
            expires_date_ms: transactionData.expiresDate
              ? transactionData.expiresDate.getTime()
              : null,
            quantity: transactionData.quantity || 1,
            web_order_line_item_id: transactionData.webOrderLineItemId,
          },
        ],
      },
      latest_receipt_info: [
        {
          product_id: transactionData.productId,
          transaction_id: transactionData.transactionId,
          original_transaction_id: transactionData.originalTransactionId,
          purchase_date_ms: transactionData.purchaseDate.getTime(),
          expires_date_ms: transactionData.expiresDate
            ? transactionData.expiresDate.getTime()
            : null,
          quantity: transactionData.quantity || 1,
          web_order_line_item_id: transactionData.webOrderLineItemId,
        },
      ],
      transactionData, // Include raw transaction data for debugging
    };
  } catch (error) {
    const errorMessage =
      typeof error === "string"
        ? error
        : error.message || "Unknown JWT verification error";
    logger.error("StoreKit 2 JWT verification failed:", {
      error: errorMessage,
      stack: error.stack,
    });
    throw new Error(`JWT verification failed: ${errorMessage}`);
  }
};

/**
 * Verify Apple App Store receipt
 * @param {string} receiptData - Base64 encoded receipt data or StoreKit 2 transaction data
 * @param {boolean} isProduction - Whether to use production or sandbox endpoint
 * @param {string} receiptFormat - "JWT" for StoreKit 2 or "Base64" for StoreKit 1
 * @returns {Promise<Object>} Verified receipt data
 */
const verifyAppleReceipt = async (
  receiptData,
  isProduction = true,
  receiptFormat = "Base64"
) => {
  // Handle StoreKit 2 receipts (JSON format with JWT tokens)
  if (
    receiptFormat === "JWT" ||
    receiptData.startsWith("{") ||
    receiptData.startsWith("eyJ")
  ) {
    logger.info("Using StoreKit 2 JWT verification");
    return await verifyStoreKit2WithAppleServer(receiptData);
  }

  // Handle StoreKit 1 Base64 receipts (legacy)
  logger.info("Using StoreKit 1 Base64 receipt verification");
  return new Promise((resolve, reject) => {
    const verifyUrl = isProduction
      ? "https://buy.itunes.apple.com/verifyReceipt"
      : "https://sandbox.itunes.apple.com/verifyReceipt";

    const appSecret = config.apple?.appSecret || process.env.APPLE_APP_SECRET; // Shared secret from App Store Connect

    const postData = JSON.stringify({
      "receipt-data": receiptData,
      password: appSecret, // Shared secret (optional, but recommended)
      "exclude-old-transactions": true,
    });

    logger.info(
      `Apple verification request - Environment: ${isProduction ? "production" : "sandbox"}`
    );
    logger.info(`Apple verification URL: ${verifyUrl}`);
    logger.info(
      `Apple verification data preview: ${postData.substring(0, 200)}...`
    );

    const url = new URL(verifyUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          logger.info(`Apple verification response status: ${res.statusCode}`);
          logger.info(
            `Apple verification response data: ${data.substring(0, 200)}...`
          );

          const response = JSON.parse(data);
          if (response.status === 0) {
            resolve(response);
          } else if (response.status === 21007) {
            // Receipt is from sandbox but was sent to production
            // Retry with sandbox
            logger.info(
              "Apple receipt from sandbox, retrying with sandbox endpoint"
            );
            verifyAppleReceipt(receiptData, false).then(resolve).catch(reject);
          } else {
            logger.error("Apple receipt verification failed:", response);
            reject(
              new Error(`Apple receipt verification failed: ${response.status}`)
            );
            logger.error(`Full response: ${JSON.stringify(response)}`);
            reject(
              new Error(
                `Apple verification failed with status: ${response.status}`
              )
            );
          }
        } catch (error) {
          logger.error(
            `Failed to parse Apple verification response. Response was: ${data.substring(0, 200)}...`
          );
          reject(
            new Error(
              `Failed to parse Apple verification response: ${error.message}`
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Apple verification request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Verify Google Play purchase token using Google Play Developer API
 * @param {string} packageName - App package name
 * @param {string} productId - Product ID (SKU)
 * @param {string} purchaseToken - Purchase token from Google Play
 * @returns {Promise<Object>} Purchase data from Google Play
 */
export const verifyGooglePurchaseToken = async (packageName, productId, purchaseToken) => {
  try {
    logger.info("Verifying Google Play purchase token using file-based authentication...");
    logger.info(`Package: ${packageName}, Product: ${productId}`);
    
    // Validate inputs
    if (!packageName || !productId || !purchaseToken) {
      throw new Error("Missing required parameters: packageName, productId, and purchaseToken");
    }
    
    // Initialize Google Auth using file-based credentials
    let authClient;
    try {
      const auth = await initializeGoogleAuth();
      authClient = await auth.getClient();
      
      // DEBUG: Verify access token generation
      try {
        const accessToken = await authClient.getAccessToken();
        const tokenString =
          typeof accessToken === "string"
            ? accessToken
            : accessToken?.token || accessToken?.access_token || null;
        logger.info("DEBUG: Access token generated successfully:", {
          hasToken: !!tokenString,
          tokenLength: tokenString?.length || 0,
          tokenPreview: tokenString
            ? tokenString.substring(0, 20) + "..."
            : "null"
        });
      } catch (tokenError) {
        logger.error("DEBUG: Access token generation failed:", {
          error: tokenError.message,
          stack: tokenError.stack
        });
      }
      
      logger.info("Google Auth client created successfully using file-based credentials");
    } catch (authError) {
      logger.error("Google authentication failed:", {
        error: authError.message,
        errorType: authError.errorType,
        debugStep: authError.debugStep,
        fix: authError.fix
      });
      
      const error = new Error(`Google authentication failed: ${authError.message}`);
      error.errorType = authError.errorType || "AUTH_ERROR";
      error.debugStep = authError.debugStep || "google_auth_initialization";
      error.originalError = authError;
      error.fix = authError.fix || "Check config/google-service-account.json file";
      throw error;
    }

    // Create Android Publisher client
    let androidpublisher;
    try {
      androidpublisher = google.androidpublisher({
        version: "v3",
        auth: authClient,
      });
      logger.info("Android Publisher client created successfully");
    } catch (clientError) {
      const error = new Error(`Failed to create Android Publisher client: ${clientError.message}`);
      error.errorType = "AUTH_ERROR";
      error.debugStep = "android_publisher_client";
      error.originalError = clientError;
      throw error;
    }

    // Verify the purchase with proper error handling
    let response;
    try {
      response = await androidpublisher.purchases.subscriptions.get({
        packageName: packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });
      logger.info("Google Play purchase verification successful");
    } catch (apiError) {
      // DEBUG: Detailed Google API error logging
      logger.error("DEBUG: Google API error details:", {
        message: apiError.message,
        code: apiError.code,
        status: apiError.status,
        response: {
          status: apiError.response?.status,
          data: apiError.response?.data,
          headers: apiError.response?.headers
        },
        errors: apiError.errors,
        packageName: packageName,
        productId: productId,
        purchaseTokenPreview: purchaseToken ? purchaseToken.substring(0, 20) + "..." : "null"
      });
      
      // Handle specific Google API errors
      if (apiError.code === 401 || apiError.status === 401) {
        const error = new Error(`Insufficient permissions for Android Publisher API: ${apiError.message}`);
        error.errorType = "AUTH_ERROR";
        error.debugStep = "api_call_permissions";
        error.originalError = apiError;
        error.needsConfigFix = true;
        throw error;
      }
      
      if (apiError.code === 403 || apiError.status === 403) {
        const error = new Error(`Access forbidden to Android Publisher API: ${apiError.message}`);
        error.errorType = "AUTH_ERROR";
        error.debugStep = "api_call_access";
        error.originalError = apiError;
        error.needsConfigFix = true;
        throw error;
      }
      
      if (apiError.code === 404 || apiError.status === 404) {
        const error = new Error(`Purchase not found or invalid: ${apiError.message}`);
        error.errorType = "INVALID_PURCHASE";
        error.debugStep = "api_call_not_found";
        error.originalError = apiError;
        throw error;
      }
      
      // General API error
      const error = new Error(`Google Play API error: ${apiError.message}`);
      error.errorType = "API_ERROR";
      error.debugStep = "api_call_general";
      error.originalError = apiError;
      throw error;
    }

    const purchaseData = response.data;
    logger.info("Google Play purchase verification completed successfully");

    return purchaseData;
  } catch (error) {
    // If error already has errorType, re-throw it
    if (error.errorType) {
      logger.error(`Google Play purchase verification failed (${error.errorType}):`, {
        message: error.message,
        debugStep: error.debugStep,
        needsConfigFix: error.needsConfigFix
      });
      throw error;
    }
    
    // Wrap unexpected errors
    logger.error("Unexpected Google Play purchase verification error:", {
      message: error.message,
      stack: error.stack
    });
    
    const wrappedError = new Error(`Google Play verification failed: ${error.message}`);
    wrappedError.errorType = "UNKNOWN_ERROR";
    wrappedError.debugStep = "unexpected_error";
    wrappedError.originalError = error;
    throw wrappedError;
  }
};

/**
 * Calculate expiration date based on billing cycle
 * @param {string} billingCycle - Billing cycle (Monthly, Quarterly, Yearly)
 * @returns {Date} Expiration date
 */
const calculateExpirationDate = (billingCycle) => {
  const now = new Date();
  const expirationDate = new Date(now);

  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      expirationDate.setMonth(expirationDate.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      expirationDate.setMonth(expirationDate.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      break;
    default:
      expirationDate.setMonth(expirationDate.getMonth() + 1);
  }

  return expirationDate;
};

/**
 * Find or create subscription plan by product ID
 * @param {string} productId - Product ID from store
 * @param {string} platform - Platform (apple or google)
 * @returns {Promise<Object>} Subscription plan
 */
const findPlanByProductId = async (productId, platform) => {
  // Try to find plan by matching product ID patterns
  // You might need to store productId in SubscriptionPlan model or have a mapping
  // For now, we'll try to infer from product ID or use a default
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({
    price: 1,
  });

  // If productId contains billing cycle hints, match them
  const billingCycleMap = {
    monthly: BillingCycle.MONTHLY,
    quarterly: BillingCycle.QUARTERLY,
    yearly: BillingCycle.YEARLY,
    month: BillingCycle.MONTHLY,
    quarter: BillingCycle.QUARTERLY,
    year: BillingCycle.YEARLY,
  };

  for (const [key, cycle] of Object.entries(billingCycleMap)) {
    if (productId.toLowerCase().includes(key)) {
      const plan = plans.find((p) => p.billingCycle === cycle);
      if (plan) return plan;
    }
  }

  // Default to first active plan (remove isVerifiedBadge requirement)
  const defaultPlan = plans.find((p) => p.isActive);
  if (!defaultPlan) {
    throw new Error("No active subscription plan found");
  }

  return defaultPlan;
};

/**
 * Grant verified badge to user
 * @param {string} userId - User ID
 * @param {Date} expirationDate - Badge expiration date
 */
const grantVerifiedBadge = async (userId, expirationDate) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.isVerifiedBadge = true;
  // Store expiration date (you might want to add this field to User model)
  // For now, we'll rely on UserSubscription.endDate
  await user.save();

  logger.info(
    `Verified badge granted to user ${userId}, expires: ${expirationDate}`
  );
};

/**
 * Revoke verified badge from user
 * @param {string} userId - User ID
 */
const revokeVerifiedBadge = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }

  user.isVerifiedBadge = false;
  await user.save();

  logger.info(`Verified badge revoked from user ${userId}`);
};

/**
 * Verify Apple purchase and update user subscription
 * @param {string} userId - User ID
 * @param {string} receiptData - Receipt data (JWT token or Base64)
 * @param {string} productId - Product ID (optional, extracted from receipt if not provided)
 * @param {string} receiptFormat - "JWT" for StoreKit 2 or "Base64" for StoreKit 1
 * @returns {Promise<Object>} Verification result
 */
export const verifyApplePurchase = async (userId, receiptData, productId = null, receiptFormat = "Base64") => {
  try {
    console.log('🍎 Apple Purchase Verification Started');
    console.log('📝 UserId:', userId);
    console.log('📦 ProductId:', productId);
    console.log('📄 ReceiptFormat:', receiptFormat);
    console.log('📊 ReceiptData preview:', receiptData ? receiptData.substring(0, 100) + '...' : 'null');
    
    // Verify receipt with Apple
    const verificationResult = await verifyAppleReceipt(receiptData, true, receiptFormat);
    
    console.log('✅ Verification Result:', {
      hasReceipt: !!verificationResult.receipt,
      hasInApp: !!(verificationResult.receipt && verificationResult.receipt.in_app),
      environment: verificationResult.environment
    });

    if (!verificationResult.receipt || !verificationResult.receipt.in_app) {
      console.log('❌ Invalid receipt data from Apple');
      throw new Error("Invalid receipt data from Apple");
    }

    // Get the latest transaction
    const latestTransaction = verificationResult.receipt.in_app
      .sort((a, b) => parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms))[0];

    if (!latestTransaction) {
      console.log('❌ No transactions found in receipt');
      throw new Error("No transactions found in receipt");
    }

    const transactionId = latestTransaction.transaction_id;
    const originalTransactionId = latestTransaction.original_transaction_id;
    const receiptProductId = latestTransaction.product_id;
    const purchaseDate = new Date(parseInt(latestTransaction.purchase_date_ms));
    const expiresDate = latestTransaction.expires_date_ms 
      ? new Date(parseInt(latestTransaction.expires_date_ms))
      : null;

    console.log('🔍 Transaction Details:', {
      transactionId,
      originalTransactionId,
      productId: receiptProductId,
      purchaseDate,
      expiresDate
    });

    // Check if this subscription already exists
    let existingSubscription = await UserSubscription.findOne({
      originalTransactionId,
      userId
    });

    console.log('🔎 Existing Subscription:', existingSubscription ? 'Found' : 'Not Found');

    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.latestTransactionId = transactionId;
      existingSubscription.productId = receiptProductId;
      existingSubscription.startDate = purchaseDate;
      existingSubscription.endDate = expiresDate || purchaseDate;
      existingSubscription.expiresAt = expiresDate || purchaseDate;
      existingSubscription.lastVerifiedAt = new Date();
      existingSubscription.status = expiresDate && expiresDate > new Date() 
        ? SubscriptionStatus.ACTIVE 
        : SubscriptionStatus.EXPIRED;
      
      await existingSubscription.save();
      
      console.log('🔄 Updated existing subscription for user', userId, 'with status:', existingSubscription.status);
    } else {
      // Create new subscription
      const newSubscription = new UserSubscription({
        userId,
        planId: null, // Will be determined based on productId
        originalTransactionId,
        latestTransactionId: transactionId,
        productId: receiptProductId,
        status: expiresDate && expiresDate > new Date() 
          ? SubscriptionStatus.ACTIVE 
          : SubscriptionStatus.EXPIRED,
        startDate: purchaseDate,
        endDate: expiresDate || purchaseDate,
        expiresAt: expiresDate || purchaseDate,
        environment: verificationResult.environment === 'sandbox' ? 'sandbox' : 'production',
        autoRenewStatus: true // Default to true, will be updated by webhooks
      });

      await newSubscription.save();
      
      console.log('➕ Created new subscription for user', userId, 'with status:', newSubscription.status);
      existingSubscription = newSubscription;
    }

    // Create payment record
    const payment = new SubscriptionPayment({
      userId,
      subscriptionId: existingSubscription._id,
      amount: 0, // Amount not available in receipt verification
      currency: "USD",
      paymentProvider: PAYMENT_PROVIDERS.APPLE,
      transactionId,
      status: existingSubscription.status,
      receiptData,
      productId: receiptProductId
    });

    await payment.save();

    // Update user's verified badge to true on successful purchase verification
    if (existingSubscription.status === SubscriptionStatus.ACTIVE) {
      console.log('🏆 Setting verified badge to TRUE for user', userId);
      await User.findByIdAndUpdate(userId, {
        isVerifiedBadge: true
      });
      logger.info(`Verified badge set to true for user ${userId} due to successful Apple purchase verification`);
    } else {
      console.log('⚠️ Subscription not active, not setting verified badge. Status:', existingSubscription.status);
    }

    console.log('✅ Apple Purchase Verification Completed Successfully');
    return {
      verified: true,
      alreadyProcessed: false,
      subscription: existingSubscription,
      payment
    };
  } catch (error) {
    console.log('❌ Apple Purchase Verification Error:', error.message);
    logger.error("Apple purchase verification error:", error);
    throw error;
  }
};

/**
 * Verify and process Google Play Store purchase
 * @param {string} userId - User ID
 * @param {string} packageName - App package name
 * @param {string} productId - Product ID (SKU)
 * @param {string} purchaseToken - Purchase token
 * @param {string} orderId - Order ID (optional, for restore purchases)
 * @returns {Promise<Object>} Verification result
 */
export const verifyGooglePurchase = async (
  userId,
  packageName,
  productId,
  purchaseToken,
  orderId = null
) => {
  try {
    console.log('🤖 Google Purchase Verification Started');
    console.log('📝 UserId:', userId);
    console.log('📦 PackageName:', packageName);
    console.log('📦 ProductId:', productId);
    console.log('🎟️ PurchaseToken preview:', purchaseToken ? purchaseToken.substring(0, 50) + '...' : 'null');
    console.log('🆔 OrderId:', orderId);
    
    // Validate userId
    if (!userId) {
      const error = new Error("userId is required for Google purchase verification");
      error.errorType = "VALIDATION_ERROR";
      error.debugStep = "user_id_validation";
      throw error;
    }
    
    // Verify purchase with Google Play Developer API
    const purchaseData = await verifyGooglePurchaseToken(
      packageName,
      productId,
      purchaseToken
    );

    console.log('✅ Google Purchase Data Received:', {
      hasData: !!purchaseData,
      purchaseState: purchaseData?.purchaseState,
      acknowledgementState: purchaseData?.acknowledgementState
    });

    const transactionId = orderId || purchaseToken; // Use orderId if provided, else purchaseToken

    // Check for duplicate transaction
    const existingPayment = await SubscriptionPayment.findOne({
      transactionId: transactionId,
      paymentProvider: PAYMENT_PROVIDERS.GOOGLE,
    });

    if (existingPayment) {
      // Transaction already processed
      const subscription = await UserSubscription.findById(
        existingPayment.subscriptionId
      ).populate("planId");

      // Ensure account verification flags stay consistent with the subscription status.
      // (If this transaction was verified before, the user flags might be out of sync.)
      if (
        subscription &&
        subscription.status === SubscriptionStatus.ACTIVE &&
        subscription.endDate > new Date()
      ) {
        await User.findByIdAndUpdate(userId, {
          isVerifiedBadge: true,
        });
      }

      return {
        verified: true,
        alreadyProcessed: true,
        subscription: {
          status: subscription.status,
          endDate: subscription.endDate,
          plan: subscription.planId,
        },
      };
    }

    // Find or create subscription plan
    const plan = await findPlanByProductId(productId, "google");

    // Calculate expiration date
    let expirationDate = calculateExpirationDate(plan.billingCycle);

    // If Google provides expiryTimeMillis, prefer that for accuracy
    if (purchaseData && purchaseData.expiryTimeMillis) {
      expirationDate = new Date(Number(purchaseData.expiryTimeMillis));
    }

    // Create user subscription
    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: expirationDate,
      // Schema requires expiresAt (also used for consistency with Apple flow)
      expiresAt: expirationDate,
    });

    await subscription.save();

    // Create payment record
    const payment = new SubscriptionPayment({
      userId,
      subscriptionId: subscription._id,
      amount: plan.price,
      currency: plan.currency,
      paymentProvider: PAYMENT_PROVIDERS.GOOGLE,
      transactionId: transactionId,
      status: SubscriptionStatus.ACTIVE,
      receiptData: purchaseToken,
      productId: productId,
      packageName: packageName,
      orderId: orderId,
    });

    await payment.save();

    // Grant verified badge
    await grantVerifiedBadge(userId, expirationDate);

    logger.info(
      `Google purchase verified for user ${userId}, transaction: ${transactionId}`
    );

    return {
      verified: true,
      subscription: {
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        plan: {
          id: plan._id,
          name: plan.name,
          billingCycle: plan.billingCycle,
        },
      },
      payment: {
        transactionId: transactionId,
        amount: payment.amount,
        currency: payment.currency,
      },
    };
  } catch (error) {
    // If error already has errorType from verifyGooglePurchaseToken, re-throw it
    if (error.errorType) {
      console.error('❌ Google Purchase Verification Error:', {
        errorType: error.errorType,
        message: error.message,
        debugStep: error.debugStep,
        needsConfigFix: error.needsConfigFix
      });
      throw error;
    }
    
    // Handle other errors
    console.error('❌ Unexpected Google Purchase Verification Error:', error.message);
    logger.error("Google purchase verification error:", error);
    
    const wrappedError = new Error(`Google purchase verification failed: ${error.message}`);
    wrappedError.errorType = "UNKNOWN_ERROR";
    wrappedError.debugStep = "purchase_processing";
    wrappedError.originalError = error;
    throw wrappedError;
  }
};

/**
 * Restore purchases for a user
 * @param {string} userId - User ID
 * @param {string} platform - Platform (apple or google)
 * @returns {Promise<Array>} List of restored subscriptions
 */
export const restorePurchases = async (userId, platform) => {
  try {
    // Get all active subscriptions for the user
    const subscriptions = await UserSubscription.find({
      userId,
      status: SubscriptionStatus.ACTIVE,
    }).populate("planId");

    const payments = await SubscriptionPayment.find({
      userId,
      paymentProvider:
        platform === "apple"
          ? PAYMENT_PROVIDERS.APPLE
          : PAYMENT_PROVIDERS.GOOGLE,
      status: SubscriptionStatus.ACTIVE,
    }).populate("subscriptionId");

    // Filter out expired subscriptions
    const activeSubscriptions = subscriptions.filter((sub) => {
      const now = new Date();
      return sub.endDate > now;
    });

    // Update expired subscriptions
    for (const sub of subscriptions) {
      if (
        sub.endDate <= new Date() &&
        sub.status === SubscriptionStatus.ACTIVE
      ) {
        sub.status = SubscriptionStatus.EXPIRED;
        await sub.save();
        await revokeVerifiedBadge(userId);
      }
    }

    return activeSubscriptions.map((sub) => ({
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      plan: {
        id: sub.planId._id,
        name: sub.planId.name,
        billingCycle: sub.planId.billingCycle,
      },
    }));
  } catch (error) {
    logger.error("Restore purchases error:", error);
    throw error;
  }
};

/**
 * Expire verified badges for users whose subscriptions have ended
 * This should be called periodically via cron job
 */
export const expireVerifiedBadges = async () => {
  try {
    const now = new Date();

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await UserSubscription.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lte: now },
    });

    logger.info(
      `Found ${expiredSubscriptions.length} expired subscriptions to process`
    );

    // Update subscription status and revoke badges
    for (const subscription of expiredSubscriptions) {
      subscription.status = SubscriptionStatus.EXPIRED;
      await subscription.save();

      await revokeVerifiedBadge(subscription.userId);

      // Update related payments
      await SubscriptionPayment.updateMany(
        { subscriptionId: subscription._id, status: SubscriptionStatus.ACTIVE },
        { $set: { status: SubscriptionStatus.EXPIRED } }
      );
    }

    logger.info(
      `Successfully processed ${expiredSubscriptions.length} expired subscriptions`
    );
    return { processed: expiredSubscriptions.length };
  } catch (error) {
    logger.error("Expire verified badges error:", error);
    throw error;
  }
};

/**
 * Get user's verified status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Verified status information
 */
export const getUserVerifiedStatus = async (userId) => {
  try {
    const user = await User.findById(userId).select("isVerifiedBadge");
    if (!user) {
      throw new Error("User not found");
    }

    // Get active subscription
    const activeSubscription = await UserSubscription.findOne({
      userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    }).populate("planId");

    return {
      isVerifiedBadge: user.isVerifiedBadge,
      subscription: activeSubscription
        ? {
            status: activeSubscription.status,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
            plan: {
              id: activeSubscription.planId._id,
              name: activeSubscription.planId.name,
              billingCycle: activeSubscription.planId.billingCycle,
            },
          }
        : null,
    };
  } catch (error) {
    logger.error("Get user verified status error:", error);
    throw error;
  }
};
