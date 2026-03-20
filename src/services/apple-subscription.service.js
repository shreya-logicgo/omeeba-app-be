import crypto from 'crypto';
import https from 'https';
import UserSubscription from '../models/subscriptions/UserSubscription.js';
import SubscriptionPayment from '../models/subscriptions/SubscriptionPayment.js';
import { SubscriptionStatus } from '../models/enums.js';
import { PAYMENT_PROVIDERS } from '../constants/index.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Verify Apple App Store Server Notification signature
 */
const verifyAppleNotification = (signedPayload, signature) => {
  try {
    const publicKey = config.apple?.appStoreServerNotificationPublicKey;
    if (!publicKey) {
      logger.error('Apple App Store Server Notification public key not configured');
      return false;
    }

    const verify = crypto.createVerify('SHA256');
    verify.update(signedPayload);
    
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    logger.error('Error verifying Apple notification signature:', error);
    return false;
  }
};

/**
 * Handle App Store Server Notification
 */
export const handleAppStoreNotification = async (notificationData) => {
  try {
    const { signedPayload, notificationUUID, notificationType, subtype, signedTransactionInfo, signedRenewalInfo } = notificationData;
    
    logger.info(`Processing App Store notification: ${notificationType}`, { notificationUUID });

    let transactionInfo = null;
    let renewalInfo = null;

    // Decode signed transaction info if present
    if (signedTransactionInfo) {
      transactionInfo = JSON.parse(Buffer.from(signedTransactionInfo, 'base64').toString());
    }

    // Decode signed renewal info if present
    if (signedRenewalInfo) {
      renewalInfo = JSON.parse(Buffer.from(signedRenewalInfo, 'base64').toString());
    }

    switch (notificationType) {
      case 'SUBSCRIBED':
        await handleSubscriptionStarted(transactionInfo, renewalInfo);
        break;
      
      case 'DID_RENEW':
        await handleSubscriptionRenewed(transactionInfo, renewalInfo);
        break;
      
      case 'EXPIRED':
        await handleSubscriptionExpired(transactionInfo, renewalInfo);
        break;
      
      case 'DID_FAIL_TO_RENEW':
        await handleRenewalFailed(transactionInfo, renewalInfo);
        break;
      
      case 'PRICE_INCREASE':
        await handlePriceIncrease(transactionInfo, renewalInfo);
        break;
      
      case 'GRACE_PERIOD_EXPIRED':
        await handleGracePeriodExpired(transactionInfo, renewalInfo);
        break;
      
      case 'REFUND':
        await handleRefund(transactionInfo, renewalInfo);
        break;
      
      case 'REVOKED':
        await handleRevoked(transactionInfo, renewalInfo);
        break;
      
      default:
        logger.warn(`Unhandled notification type: ${notificationType}`);
    }

    logger.info(`Successfully processed notification: ${notificationUUID}`);
  } catch (error) {
    logger.error('Error handling App Store notification:', error);
    throw error;
  }
};

/**
 * Handle subscription started
 */
const handleSubscriptionStarted = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId, transactionId, productId, purchaseDate, expiresDate } = transactionInfo;
  
  // Find existing subscription
  let subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    // Create new subscription record
    subscription = new UserSubscription({
      originalTransactionId,
      latestTransactionId: transactionId,
      productId,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(parseInt(purchaseDate) * 1000),
      endDate: new Date(parseInt(expiresDate) * 1000),
      expiresAt: new Date(parseInt(expiresDate) * 1000),
      autoRenewStatus: renewalInfo?.autoRenewStatus === true,
      environment: transactionInfo.environment || 'production'
    });
  } else {
    // Update existing subscription
    subscription.latestTransactionId = transactionId;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.startDate = new Date(parseInt(purchaseDate) * 1000);
    subscription.endDate = new Date(parseInt(expiresDate) * 1000);
    subscription.expiresAt = new Date(parseInt(expiresDate) * 1000);
    subscription.autoRenewStatus = renewalInfo?.autoRenewStatus === true;
    subscription.cancellationReason = null;
  }

  await subscription.save();

  // Create payment record
  await createPaymentRecord(subscription.userId, transactionInfo, SubscriptionStatus.ACTIVE);

  logger.info(`Subscription started for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Handle subscription renewal
 */
const handleSubscriptionRenewed = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId, transactionId, productId, purchaseDate, expiresDate } = transactionInfo;
  
  const subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    logger.error(`Subscription not found for renewal: ${originalTransactionId}`);
    return;
  }

  // Update subscription with new transaction
  subscription.latestTransactionId = transactionId;
  subscription.status = SubscriptionStatus.ACTIVE;
  subscription.endDate = new Date(parseInt(expiresDate) * 1000);
  subscription.expiresAt = new Date(parseInt(expiresDate) * 1000);
  subscription.lastVerifiedAt = new Date();
  subscription.autoRenewStatus = renewalInfo?.autoRenewStatus === true;
  subscription.cancellationReason = null;

  await subscription.save();

  // Create payment record for renewal
  await createPaymentRecord(subscription.userId, transactionInfo, SubscriptionStatus.ACTIVE);

  logger.info(`Subscription renewed for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Handle subscription expired
 */
const handleSubscriptionExpired = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId, expiresDate } = transactionInfo;
  
  const subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    logger.error(`Subscription not found for expiration: ${originalTransactionId}`);
    return;
  }

  subscription.status = SubscriptionStatus.EXPIRED;
  subscription.endDate = new Date(parseInt(expiresDate) * 1000);
  subscription.expiresAt = new Date(parseInt(expiresDate) * 1000);
  subscription.lastVerifiedAt = new Date();
  
  // Set cancellation reason if auto-renew is disabled
  if (renewalInfo?.autoRenewStatus === false) {
    subscription.cancellationReason = 'USER_CANCELLED';
  } else {
    subscription.cancellationReason = 'EXPIRED_INTENTIONALLY';
  }

  await subscription.save();

  logger.info(`Subscription expired for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Handle renewal failure
 */
const handleRenewalFailed = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId } = transactionInfo;
  
  const subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    logger.error(`Subscription not found for renewal failure: ${originalTransactionId}`);
    return;
  }

  // Check if we're in grace period
  if (renewalInfo?.gracePeriodExpiresDate) {
    subscription.status = SubscriptionStatus.ACTIVE; // Keep active during grace period
    subscription.expiresAt = new Date(parseInt(renewalInfo.gracePeriodExpiresDate) * 1000);
    logger.info(`Subscription in grace period for originalTransactionId: ${originalTransactionId}`);
  } else {
    subscription.status = SubscriptionStatus.EXPIRED;
    subscription.cancellationReason = 'BILLING_ERROR';
  }

  subscription.lastVerifiedAt = new Date();
  await subscription.save();

  logger.info(`Renewal failed for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Handle price increase
 */
const handlePriceIncrease = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId } = transactionInfo;
  
  logger.info(`Price increase notification for originalTransactionId: ${originalTransactionId}`);
  // This is typically handled on the client side, but we can log it for analytics
};

/**
 * Handle grace period expired
 */
const handleGracePeriodExpired = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId } = transactionInfo;
  
  const subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    logger.error(`Subscription not found for grace period expiration: ${originalTransactionId}`);
    return;
  }

  subscription.status = SubscriptionStatus.EXPIRED;
  subscription.cancellationReason = 'BILLING_ERROR';
  subscription.lastVerifiedAt = new Date();

  await subscription.save();

  logger.info(`Grace period expired for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Handle refund
 */
const handleRefund = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId, transactionId } = transactionInfo;
  
  const subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    logger.error(`Subscription not found for refund: ${originalTransactionId}`);
    return;
  }

  subscription.status = SubscriptionStatus.CANCELLED;
  subscription.cancellationReason = 'REFUND';
  subscription.lastVerifiedAt = new Date();

  await subscription.save();

  // Update payment record to show refund
  await SubscriptionPayment.findOneAndUpdate(
    { transactionId },
    { status: SubscriptionStatus.CANCELLED },
    { new: true }
  );

  logger.info(`Refund processed for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Handle revoked subscription
 */
const handleRevoked = async (transactionInfo, renewalInfo) => {
  const { originalTransactionId } = transactionInfo;
  
  const subscription = await UserSubscription.findOne({
    originalTransactionId,
    userId: { $exists: true }
  });

  if (!subscription) {
    logger.error(`Subscription not found for revocation: ${originalTransactionId}`);
    return;
  }

  subscription.status = SubscriptionStatus.CANCELLED;
  subscription.cancellationReason = 'REVOKED';
  subscription.lastVerifiedAt = new Date();

  await subscription.save();

  logger.info(`Subscription revoked for originalTransactionId: ${originalTransactionId}`);
};

/**
 * Create payment record
 */
const createPaymentRecord = async (userId, transactionInfo, status) => {
  try {
    const payment = new SubscriptionPayment({
      userId,
      subscriptionId: null, // Will be populated later
      amount: 0, // Amount not available in transaction info
      currency: 'USD',
      paymentProvider: PAYMENT_PROVIDERS.APPLE,
      transactionId: transactionInfo.transactionId,
      status,
      receiptData: JSON.stringify(transactionInfo),
      productId: transactionInfo.productId,
    });

    await payment.save();
    return payment;
  } catch (error) {
    logger.error('Error creating payment record:', error);
    throw error;
  }
};

/**
 * Verify subscription status with Apple (hourly check)
 */
export const verifySubscriptionStatus = async (subscription) => {
  try {
    const { originalTransactionId, environment } = subscription;
    
    // Use App Store Server API to get latest transaction info
    const transactionInfo = await getLatestTransactionInfo(originalTransactionId, environment);
    
    if (!transactionInfo) {
      logger.warn(`No transaction info found for ${originalTransactionId}`);
      return subscription;
    }

    // Update subscription based on latest transaction info
    const currentStatus = determineSubscriptionStatus(transactionInfo);
    
    subscription.status = currentStatus.status;
    subscription.expiresAt = currentStatus.expiresAt;
    subscription.autoRenewStatus = currentStatus.autoRenewStatus;
    subscription.lastVerifiedAt = new Date();
    subscription.latestTransactionId = transactionInfo.transactionId;

    if (currentStatus.cancellationReason) {
      subscription.cancellationReason = currentStatus.cancellationReason;
    }

    await subscription.save();

    logger.info(`Subscription status verified for ${originalTransactionId}: ${currentStatus.status}`);
    
    return subscription;
  } catch (error) {
    logger.error(`Error verifying subscription status for ${subscription.originalTransactionId}:`, error);
    return subscription;
  }
};

/**
 * Get latest transaction info from App Store Server API
 */
const getLatestTransactionInfo = async (originalTransactionId, environment = 'production') => {
  return new Promise((resolve, reject) => {
    const isProduction = environment === 'production';
    const apiUrl = isProduction 
      ? `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${originalTransactionId}`
      : `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${originalTransactionId}`;

    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAppStoreServerToken()}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(apiUrl, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            resolve(response.signedTransactionInfo ? 
              JSON.parse(Buffer.from(response.signedTransactionInfo, 'base64').toString()) : null);
          } else {
            logger.error(`App Store API error: ${res.statusCode}, ${data}`);
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

/**
 * Get App Store Server API token
 */
const getAppStoreServerToken = () => {
  // This should be generated using Apple's private key
  // For now, return from config
  return config.apple?.appStoreServerToken;
};

/**
 * Determine subscription status from transaction info
 */
const determineSubscriptionStatus = (transactionInfo) => {
  const now = new Date();
  const expiresDate = new Date(parseInt(transactionInfo.expiresDate) * 1000);
  const isExpired = now > expiresDate;
  const isRevoked = transactionInfo.revocationDate && new Date(parseInt(transactionInfo.revocationDate) * 1000) <= now;

  if (isRevoked) {
    return {
      status: SubscriptionStatus.CANCELLED,
      expiresAt: expiresDate,
      autoRenewStatus: false,
      cancellationReason: 'REVOKED'
    };
  }

  if (isExpired) {
    return {
      status: SubscriptionStatus.EXPIRED,
      expiresAt: expiresDate,
      autoRenewStatus: false,
      cancellationReason: 'EXPIRED_INTENTIONALLY'
    };
  }

  return {
    status: SubscriptionStatus.ACTIVE,
    expiresAt: expiresDate,
    autoRenewStatus: true,
    cancellationReason: null
  };
};

export default {
  handleAppStoreNotification,
  verifySubscriptionStatus,
  verifyAppleNotification
};
