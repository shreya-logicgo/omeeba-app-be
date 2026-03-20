# Apple Subscription Management Setup Guide

This document explains how to set up and configure Apple subscription management with auto-renewal and cancellation flow.

## Overview

The system includes:
- **Webhook Handler**: Receives real-time notifications from Apple
- **Hourly Verification**: Automatically checks subscription status
- **Auto-renewal Management**: Handles subscription renewals
- **Cancellation Flow**: Processes subscription cancellations
- **Admin Dashboard**: Management endpoints for monitoring

## Environment Variables

Add these to your `.env` file:

```bash
# Apple App Store Configuration
APPLE_APP_SECRET=your_app_store_shared_secret
APPLE_APP_STORE_SERVER_TOKEN=your_app_store_server_api_token
APPLE_APP_STORE_SERVER_NOTIFICATION_PUBLIC_KEY=your_public_key_for_webhook_verification

# Apple Environment (sandbox/production)
APPLE_ENVIRONMENT=production
```

## Apple App Store Setup

### 1. App Store Connect Configuration

1. **Enable Server Notifications**:
   - Go to App Store Connect → Your App → Features → In-App Purchases
   - Select your subscription products
   - Enable "App Store Server Notifications"
   - Set the webhook URL: `https://your-domain.com/api/v1/apple/webhook`

2. **Generate App Store Server API Key**:
   - Go to App Store Connect → Users and Access → Keys
   - Create a new "App Store Server API" key
   - Download the private key (`.p8` file)
   - Note the Key ID and Issuer ID

### 2. Webhook Configuration

**Webhook URL**: `POST https://your-domain.com/api/v1/apple/webhook`

**Security**: The webhook validates Apple's signature using the public key you configure.

### 3. Supported Notification Types

The system handles these Apple notification types:

- `SUBSCRIBED` - New subscription created
- `DID_RENEW` - Subscription renewed
- `EXPIRED` - Subscription expired
- `DID_FAIL_TO_RENEW` - Renewal failed (grace period)
- `PRICE_INCREASE` - Price increase notification
- `GRACE_PERIOD_EXPIRED` - Grace period ended
- `REFUND` - Subscription refunded
- `REVOKED` - Subscription revoked

## Database Schema

### UserSubscription Model

```javascript
{
  userId: ObjectId,
  planId: ObjectId,
  status: String, // ACTIVE, EXPIRED, CANCELLED, PENDING
  startDate: Date,
  endDate: Date,
  expiresAt: Date,
  
  // Apple-specific fields
  originalTransactionId: String,
  latestTransactionId: String,
  productId: String,
  autoRenewStatus: Boolean,
  lastVerifiedAt: Date,
  cancellationReason: String,
  latestReceiptData: String,
  environment: String // sandbox/production
}
```

## API Endpoints

### Webhook Endpoints

- `POST /api/v1/apple/webhook` - Handle Apple notifications
- `GET /api/v1/apple/webhook/test` - Test webhook endpoint
- `GET /api/v1/apple/webhook/health` - Health check

### Admin Management Endpoints (Admin Only)

- `POST /api/v1/apple/subscriptions/verify` - Manual verification trigger
- `GET /api/v1/apple/subscriptions` - List all subscriptions
- `GET /api/v1/apple/subscriptions/stats` - Subscription statistics
- `GET /api/v1/apple/subscriptions/transaction/:transactionId` - Get subscription details
- `POST /api/v1/apple/subscriptions/transaction/:transactionId/verify` - Verify specific subscription

## Automated Processes

### Hourly Verification Cron Job

Runs every hour at minute 0:
- Checks all active Apple subscriptions
- Verifies status with Apple's servers
- Updates subscription status accordingly
- Handles expired subscriptions

### Auto-renewal Flow

1. **Renewal Notification**: Apple sends `DID_RENEW` webhook
2. **Status Update**: System updates subscription to ACTIVE
3. **New Transaction**: Creates payment record for renewal
4. **Extension**: Updates expiration date

### Cancellation Flow

1. **Cancellation Detection**: Apple sends `EXPIRED` or `REVOKED` webhook
2. **Status Update**: System updates subscription to CANCELLED/EXPIRED
3. **Reason Tracking**: Records cancellation reason
4. **Access Revocation**: User loses premium access

## Testing

### Sandbox Testing

1. Use sandbox environment for testing
2. Set `APPLE_ENVIRONMENT=sandbox`
3. Use sandbox Apple IDs for testing
4. Test with test subscription products

### Webhook Testing

```bash
# Test webhook endpoint
curl -X GET https://your-domain.com/api/v1/apple/webhook/test

# Health check
curl -X GET https://your-domain.com/api/v1/apple/webhook/health
```

### Manual Verification

```bash
# Trigger manual verification (admin only)
curl -X POST https://your-domain.com/api/v1/apple/subscriptions/verify \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Monitoring

### Logs

Monitor these log messages:
- `Apple subscription verification cron job started`
- `Processing App Store notification: [TYPE]`
- `Subscription renewed for originalTransactionId: [ID]`
- `Subscription expired for originalTransactionId: [ID]`

### Metrics to Track

- Active subscriptions count
- Renewal success rate
- Cancellation reasons
- Verification failures
- Webhook processing time

## Troubleshooting

### Common Issues

1. **Webhook Not Receiving Notifications**:
   - Check webhook URL in App Store Connect
   - Verify SSL certificate
   - Check firewall settings

2. **Signature Verification Fails**:
   - Ensure public key is correctly configured
   - Check if using correct algorithm (ES256)

3. **Subscription Status Mismatch**:
   - Run manual verification
   - Check Apple's App Store Server API status
   - Verify environment (sandbox vs production)

4. **Cron Job Not Running**:
   - Check server logs for cron job startup
   - Verify timezone settings
   - Check if server process is running

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## Security Considerations

1. **Webhook Security**:
   - Always verify Apple's signature
   - Use HTTPS for webhook URL
   - Rate limit webhook endpoints

2. **API Security**:
   - Protect admin endpoints with authentication
   - Use API keys for Apple API calls
   - Log all admin actions

3. **Data Protection**:
   - Encrypt sensitive data at rest
   - Use secure connections for API calls
   - Implement proper access controls

## Deployment

### Production Checklist

- [ ] Configure production Apple credentials
- [ ] Set up SSL certificate for webhook URL
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Test webhook connectivity
- [ ] Verify cron job scheduling
- [ ] Set up log rotation
- [ ] Configure backup procedures

## Support

For issues with:
- **Apple App Store Connect**: Contact Apple Developer Support
- **Integration Issues**: Check logs and documentation
- **Server Issues**: Check system resources and configuration
