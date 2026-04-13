console.log("🚀 Redirect script started");

const ANDROID_PACKAGE = "com.omeeba.app";
const IOS_APP_STORE_ID = "6753140500";
const APP_SCHEME = "omeeba";
const WEB_FALLBACK_URL = "https://omeeba.co.in/";
const IOS_FALLBACK_DELAY_MS = 2200;
const ANDROID_FALLBACK_DELAY_MS = 2500;

// Detect device
function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Normalize path
function normalizePath(pathValue) {
  return String(pathValue || "").replace(/^\/+|\/+$/g, "");
}

// Validate share path
function looksLikeSharePath(pathValue) {
  const parts = normalizePath(pathValue).split("/").filter(Boolean);
  return parts[0] === "share" && parts.length >= 3;
}

// Get target path
function getTargetPath() {
  const currentPath = normalizePath(window.location.pathname);

  if (looksLikeSharePath(currentPath)) {
    return currentPath;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizePath(params.get("path") || params.get("target"));

  if (looksLikeSharePath(fromQuery)) {
    return fromQuery;
  }

  return "";
}

// Build deep links
function buildDeepLink(pathValue) {
  return pathValue ? `${APP_SCHEME}://${pathValue}` : `${APP_SCHEME}://`;
}

function buildAndroidIntentUrl(pathValue, fallbackUrl) {
  const intentPath = pathValue || "";
  const encodedFallback = encodeURIComponent(fallbackUrl);

  return `intent://${intentPath}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodedFallback};end`;
}

// Generate values
const targetPath = getTargetPath();
const appDeepLink = buildDeepLink(targetPath);
const playStoreUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const appStoreUrl = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`;
const androidIntentUrl = buildAndroidIntentUrl(targetPath, playStoreUrl);

// Debug logs
console.log("Target Path:", targetPath);
console.log("Deep Link:", appDeepLink);
console.log("Intent URL:", androidIntentUrl);

// Redirect to store
function redirectToStore() {
  console.log("⚠️ Redirecting to store...");

  if (isAndroid()) {
    window.location.replace(playStoreUrl);
  } else if (isIOS()) {
    window.location.replace(appStoreUrl);
  } else {
    window.location.replace(WEB_FALLBACK_URL);
  }
}

// Attempt open app
function attemptOpen(openUrl, fallbackDelayMs) {
  let appOpened = false;

  const visibilityHandler = () => {
    if (document.hidden) {
      appOpened = true;
      console.log("✅ App opened");
    }
  };

  document.addEventListener("visibilitychange", visibilityHandler);

  // Try opening app
  window.location.replace(openUrl);

  setTimeout(() => {
    document.removeEventListener("visibilitychange", visibilityHandler);

    if (!appOpened) {
      console.log("❌ App not opened, fallback...");
      redirectToStore();
    }
  }, fallbackDelayMs);
}

// Start flow
function startRedirectFlow() {
  console.log("Starting redirect flow...");

  if (isAndroid()) {
    attemptOpen(androidIntentUrl, ANDROID_FALLBACK_DELAY_MS);
    return;
  }

  if (isIOS()) {
    attemptOpen(appDeepLink, IOS_FALLBACK_DELAY_MS);
    return;
  }

  redirectToStore();
}

// Run
startRedirectFlow();