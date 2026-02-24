// utils/followUtils.js
export const getIsFollowing = (content, currentUserId, followedUserIdSet) => {
  if (!currentUserId) return null;

  // Determine creatorId for all content types
  const creatorId =
    content.userId?.id?.toString() || // Zeel, Post, Write Post from formatted content
    content.userId?._id?.toString() || // fallback
    content.createdBy?.id?.toString() || // Poll formatted
    content.createdBy?._id?.toString(); // Poll raw

  if (!creatorId || creatorId === currentUserId.toString()) {
    // Own content → hide follow
    return null;
  }

  // Other user → check if logged-in user follows
  return followedUserIdSet.has(creatorId);
};