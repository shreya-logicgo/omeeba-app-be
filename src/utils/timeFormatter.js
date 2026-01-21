/**
 * Time Formatter Utility
 * Format dates for chat display (12-hour format with AM/PM)
 */

/**
 * Format date to 12-hour time format (e.g., "11:02 AM", "10:20 AM")
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted time string (e.g., "11:02 AM")
 */
export const formatTime12Hour = (date) => {
  if (!date) {
    return "";
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return "";
  }

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  
  return `${hours}:${minutesStr} ${ampm}`;
};

/**
 * Format date for chat list (shows time if today, date if older)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted string
 */
export const formatChatListTime = (date) => {
  if (!date) {
    return "";
  }

  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // If today, show time
  if (messageDate.getTime() === today.getTime()) {
    return formatTime12Hour(d);
  }

  // If yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (messageDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  // If this week, show day name
  const diffDays = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[d.getDay()];
  }

  // Otherwise show date
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};

export default {
  formatTime12Hour,
  formatChatListTime,
};
