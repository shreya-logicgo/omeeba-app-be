# Apple Subscription API Test Commands

This document provides sample curl commands to test the Apple subscription management API endpoints.

## Base URL
Replace `your-domain.com` with your actual domain or `localhost:3000` for local testing.

## Authentication
For admin endpoints, you'll need a JWT token. First, login as an admin:

```bash
# Login as admin to get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-admin-password"
  }'
```

Extract the `token` from the response and use it in the `Authorization` header.

## Webhook Endpoints

### 1. Test Webhook Endpoint
```bash
curl -X GET http://localhost:3000/api/v1/apple/webhook/test
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Apple webhook endpoint is working",
  "data": {
    "message": "Apple webhook endpoint is working",
    "timestamp": "2026-03-17T12:00:00.000Z",
    "method": "GET",
    "userAgent": "curl/7.79.1"
  }
}
```

### 2. Webhook Health Check
```bash
curl -X GET http://localhost:3000/api/v1/apple/webhook/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook service is healthy",
  "data": {
    "status": "healthy",
    "service": "apple-webhook",
    "timestamp": "2026-03-17T12:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### 3. Simulate Apple Webhook Notification
```bash
# This would normally be sent by Apple, but here's a test structure
curl -X POST http://localhost:3000/api/v1/apple/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "signedPayload": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "signature": "sample-signature"
  }'
```

## Admin Management Endpoints (Require Authentication)

Replace `YOUR_JWT_TOKEN` with the actual token from login.

### 4. Manually Trigger Subscription Verification
```bash
curl -X POST http://localhost:3000/api/v1/apple/subscriptions/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Apple subscription verification completed",
  "data": {
    "message": "Verification completed",
    "results": {
      "total": 5,
      "successful": 4,
      "failed": 1,
      "details": [
        {
          "success": true,
          "subscriptionId": "507f1f77bcf86cd799439011"
        },
        {
          "success": false,
          "subscriptionId": "507f1f77bcf86cd799439012",
          "error": "API rate limit exceeded"
        }
      ]
    }
  }
}
```

### 5. Get All Apple Subscriptions
```bash
# Get all subscriptions
curl -X GET "http://localhost:3000/api/v1/apple/subscriptions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get subscriptions with pagination
curl -X GET "http://localhost:3000/api/v1/apple/subscriptions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by status
curl -X GET "http://localhost:3000/api/v1/apple/subscriptions?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Apple subscriptions retrieved successfully",
  "data": {
    "subscriptions": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "userId": {
          "_id": "507f1f77bcf86cd799439010",
          "username": "john_doe",
          "email": "john@example.com"
        },
        "planId": {
          "_id": "507f1f77bcf86cd799439020",
          "name": "Premium Monthly",
          "billingCycle": "Monthly",
          "price": 9.99
        },
        "status": "ACTIVE",
        "startDate": "2026-03-01T12:00:00.000Z",
        "endDate": "2026-04-01T12:00:00.000Z",
        "originalTransactionId": "1000000987654321",
        "latestTransactionId": "2000000987654322",
        "productId": "com.yourapp.premium_monthly",
        "autoRenewStatus": true,
        "lastVerifiedAt": "2026-03-17T12:00:00.000Z",
        "environment": "production"
      }
    ],
    "pagination": {
      "current": 1,
      "pageSize": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### 6. Get Subscription Statistics
```bash
curl -X GET http://localhost:3000/api/v1/apple/subscriptions/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Subscription statistics retrieved successfully",
  "data": {
    "total": 150,
    "active": 120,
    "expired": 25,
    "cancelled": 5,
    "expiringSoon": 8,
    "breakdown": [
      { "_id": "ACTIVE", "count": 120 },
      { "_id": "EXPIRED", "count": 25 },
      { "_id": "CANCELLED", "count": 5 }
    ],
    "renewalRate": "80.00"
  }
}
```

### 7. Get Subscription by Transaction ID
```bash
curl -X GET "http://localhost:3000/api/v1/apple/subscriptions/transaction/1000000987654321" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Subscription details retrieved successfully",
  "data": {
    "subscription": {
      "_id": "507f1f77bcf86cd799439011",
      "userId": {
        "_id": "507f1f77bcf86cd799439010",
        "username": "john_doe",
        "email": "john@example.com"
      },
      "planId": {
        "_id": "507f1f77bcf86cd799439020",
        "name": "Premium Monthly",
        "billingCycle": "Monthly",
        "price": 9.99
      },
      "status": "ACTIVE",
      "originalTransactionId": "1000000987654321",
      "latestTransactionId": "2000000987654322",
      "autoRenewStatus": true,
      "cancellationReason": null
    }
  }
}
```

### 8. Force Verify Specific Subscription
```bash
curl -X POST "http://localhost:3000/api/v1/apple/subscriptions/transaction/1000000987654321/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Specific subscription verified successfully",
  "data": {
    "subscription": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "ACTIVE",
      "lastVerifiedAt": "2026-03-17T12:30:00.000Z"
    },
    "message": "Subscription verification completed"
  }
}
```

## Error Response Examples

### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Access token is required"
  }
}
```

### Authorization Error
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "User role 'user' is not authorized to access this route"
  }
}
```

### Not Found Error
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Subscription not found"
  }
}
```

## Testing with Variables

Create a script file for easier testing:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

# Test functions
test_webhook() {
    echo "Testing webhook endpoint..."
    curl -X GET "$BASE_URL/api/v1/apple/webhook/test"
    echo -e "\n"
}

test_health() {
    echo "Testing webhook health..."
    curl -X GET "$BASE_URL/api/v1/apple/webhook/health"
    echo -e "\n"
}

test_stats() {
    echo "Testing subscription stats..."
    curl -X GET "$BASE_URL/api/v1/apple/subscriptions/stats" \
         -H "Authorization: Bearer $JWT_TOKEN"
    echo -e "\n"
}

test_subscriptions() {
    echo "Testing get subscriptions..."
    curl -X GET "$BASE_URL/api/v1/apple/subscriptions?limit=5" \
         -H "Authorization: Bearer $JWT_TOKEN"
    echo -e "\n"
}

# Run tests
test_webhook
test_health
test_stats
test_subscriptions
```

Save this as `test-apple-api.sh` and make it executable:
```bash
chmod +x test-apple-api.sh
./test-apple-api.sh
```

## Webhook Testing with ngrok

For testing webhooks from Apple during development:

1. Install ngrok:
```bash
npm install -g ngrok
```

2. Start your server
3. Run ngrok:
```bash
ngrok http 3000
```

4. Use the ngrok URL in App Store Connect:
```
https://your-ngrok-id.ngrok.io/api/v1/apple/webhook
```

5. Test the webhook:
```bash
curl -X GET "https://your-ngrok-id.ngrok.io/api/v1/apple/webhook/test"
```

## Tips for Testing

1. **Use proper authentication**: Always include valid JWT tokens for admin endpoints
2. **Check response codes**: 200 for success, 401 for auth errors, 403 for permission errors
3. **Validate JSON**: Use `jq` to format JSON responses: `curl ... | jq .`
4. **Monitor logs**: Check server logs for detailed error messages
5. **Test edge cases**: Try invalid transaction IDs, missing tokens, etc.
6. **Use environment variables**: Store your JWT token and base URL in environment variables

## Common Issues and Solutions

1. **401 Unauthorized**: Check your JWT token is valid and not expired
2. **403 Forbidden**: Ensure your user has admin role
3. **404 Not Found**: Verify the endpoint URL is correct
4. **500 Internal Server Error**: Check server logs for detailed error information
