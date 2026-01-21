/**
 * Time Ago Utility
 * Convert dates to relative time format (e.g., "30m", "11h", "2d")
 */

/**
 * Format number with commas (e.g., 1579 -> "1,579")
 * @param {number} num - Number to format
 * @returns {string} Formatted number with commas
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) {
    return "0";
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Get relative time ago string
 * @param {Date|string} date - Date to calculate time ago from
 * @returns {string} Relative time string (e.g., "30m", "11h", "2d", "1w", "1mo", "1y")
 */
export const getTimeAgo = (date) => {
  if (!date) {
    return "";
  }

  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  // Less than 1 minute
  if (diffInSeconds < 60) {
    return "now";
  }

  // Less than 1 hour
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`;
  }

  // Less than 1 day
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h`;
  }

  // Less than 1 week
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d`;
  }

  // Less than 1 month (approximately 30 days)
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks}w`;
  }

  // Less than 1 year
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months}mo`;
  }

  // 1 year or more
  const years = Math.floor(diffInDays / 365);
  return `${years}y`;
};

export default {
  getTimeAgo,
  formatNumber,
};
