/**
 * Simple script to test in-app purchase verification APIs (Apple & Google).
 *
 * Usage examples (run while backend server is running):
 *
 *  node scripts/test-iap.js apple "<BASE64_RECEIPT_DATA>" "[OPTIONAL_PRODUCT_ID]"
 *  node scripts/test-iap.js google "<PACKAGE_NAME>" "<PRODUCT_ID>" "<PURCHASE_TOKEN>" "[OPTIONAL_ORDER_ID]"
 *
 * NOTE:
 * - You must use a valid user auth token in IAP_TEST_AUTH_TOKEN env variable.
 * - For real verification, pass real sandbox/production receipts from device.
 */

import "dotenv/config";

const BASE_URL = process.env.IAP_TEST_BASE_URL || "http://localhost:3000";
const API_VERSION = process.env.API_VERSION || "v1";

const AUTH_TOKEN = process.env.IAP_TEST_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error(
    "ERROR: Please set IAP_TEST_AUTH_TOKEN in your .env (a valid Bearer JWT for some user)."
  );
  process.exit(1);
}

const [, , platform, ...args] = process.argv;

if (!platform || !["apple", "google"].includes(platform.toLowerCase())) {
  console.error(
    'Usage:\n' +
      '  node scripts/test-iap.js apple "<BASE64_RECEIPT_DATA>" "[OPTIONAL_PRODUCT_ID]"\n' +
      '  node scripts/test-iap.js google "<PACKAGE_NAME>" "<PRODUCT_ID>" "<PURCHASE_TOKEN>" "[OPTIONAL_ORDER_ID]"'
  );
  process.exit(1);
}

async function callApi(path, body) {
  const url = `${BASE_URL}/api/${API_VERSION}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  console.log(`\nStatus: ${res.status}`);
  console.log("Response:");
  console.dir(json, { depth: null });
}

async function main() {
  if (platform.toLowerCase() === "apple") {
    const [receiptData, productId] = args;
    if (!receiptData) {
      console.error(
        'Apple usage:\n  node scripts/test-iap.js apple "<BASE64_RECEIPT_DATA>" "[OPTIONAL_PRODUCT_ID]"'
      );
      process.exit(1);
    }

    await callApi("/purchases/verify/apple", {
      receiptData,
      ...(productId ? { productId } : {}),
    });
  } else {
    const [packageName, productId, purchaseToken, orderId] = args;
    if (!packageName || !productId || !purchaseToken) {
      console.error(
        'Google usage:\n  node scripts/test-iap.js google "<PACKAGE_NAME>" "<PRODUCT_ID>" "<PURCHASE_TOKEN>" "[OPTIONAL_ORDER_ID]"'
      );
      process.exit(1);
    }

    await callApi("/purchases/verify/google", {
      packageName,
      productId,
      purchaseToken,
      ...(orderId ? { orderId } : {}),
    });
  }
}

main().catch((err) => {
  console.error("Test script error:", err);
  process.exit(1);
});

