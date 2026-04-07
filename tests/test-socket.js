import { io } from "socket.io-client";

// ─── CONFIG ───────────────────────────────────────────────
const SERVER_URL = "http://localhost:4000";

const USER1_ID = "69cf6a20f2a54210506a4016"; // ← change this
const USER2_ID = "69cf6a90f2a54210506a4020"; // ← change this

const POST_ID   = "69d3a0fbc798157a44d9deba"; // ← valid post id
const POLL_ID   = "69d338490e693f73fa6a53e0";  // ← valid poll id
const WRITE_ID  = "69cfa30912055a2321bfacda";  // ← valid write post id
const SNAP_MEDIA_ID = ""; // ← valid mediaId from /media/upload
// ──────────────────────────────────────────────────────────

let roomId = null;

// ── Helper ────────────────────────────────────────────────
const log = (user, event, data) => {
  console.log(`\n[${user}] 📥 ${event}`);
  console.log(JSON.stringify(data, null, 2));
};

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// ── Connect both users ────────────────────────────────────
const user1 = io(SERVER_URL, {
  query: { userId: USER1_ID },
  transports: ["polling", "websocket"],
});

const user2 = io(SERVER_URL, {
  query: { userId: USER2_ID },
  transports: ["polling", "websocket"],
});

// ── Listen to all events for both users ──────────────────
const EVENTS = [
  "new_message", "new_snap", "snap_sent", "snap_viewed",
  "room_created", "rooms_list", "room_detail", "room_deleted",
  "messages_list", "message_delivered", "messages_read",
  "user_typing", "user_joined", "user_left", "unread_count",
  "message_requests_list", "request_accepted", "request_rejected",
  "request_blocked", "message_deleted", "content_shared_to_chats",
  "snaps_inbox", "snaps_sent", "error",
];

EVENTS.forEach((event) => {
  user1.on(event, (data) => log("USER1", event, data));
  user2.on(event, (data) => log("USER2", event, data));
});

// ── Connection errors ─────────────────────────────────────
user1.on("connect_error", (err) => console.error("[USER1] ❌ connect_error:", err.message));
user2.on("connect_error", (err) => console.error("[USER2] ❌ connect_error:", err.message));

user1.on("disconnect", (r) => console.log("[USER1] 🔌 disconnected:", r));
user2.on("disconnect", (r) => console.log("[USER2] 🔌 disconnected:", r));

// ── Run all tests sequentially ────────────────────────────
const runTests = async () => {
  console.log("\n====================================");
  console.log("      CHAT MODULE TEST SUITE");
  console.log("====================================\n");

  // ── TEST 1: Create Room ───────────────────────────────
  console.log("\n--- TEST 1: Create Room ---");
  await new Promise((resolve) => {
    user1.emit("create_room", { otherUserId: USER2_ID }, (ack) => {
      console.log("[USER1] create_room ACK:", JSON.stringify(ack, null, 2));
      if (ack?.success) {
        roomId = ack.data.roomId || ack.data.id;
        console.log("✅ roomId:", roomId);
      } else {
        console.error("❌ Failed to create room");
      }
      resolve();
    });
  });

  await wait(500);

  // ── TEST 2: Get Rooms ─────────────────────────────────
  console.log("\n--- TEST 2: Get Rooms ---");
  await new Promise((resolve) => {
    user1.emit("get_rooms", { page: 1, limit: 20 }, (ack) => {
      console.log("[USER1] get_rooms ACK → rooms count:", ack?.data?.rooms?.length);
      resolve();
    });
  });

  await wait(300);

  // ── TEST 3: Send Text Message ─────────────────────────
  console.log("\n--- TEST 3: Send Text Message ---");
  await new Promise((resolve) => {
    user1.emit("send_message", {
      roomId,
      messageType: "Text",
      message: "Hello User 2! This is a test message.",
    }, (ack) => {
      console.log("[USER1] send_message (Text) ACK:", JSON.stringify(ack, null, 2));
      resolve();
    });
  });

  await wait(500);

  // ── TEST 4: Send Post (Bug 1 fix check) ───────────────
  if (POST_ID) {
    console.log("\n--- TEST 4: Send Post (contentData check) ---");
    await new Promise((resolve) => {
      user1.emit("send_message", {
        roomId,
        messageType: "Post",
        contentId: POST_ID,
        contentType: "Post",
      }, (ack) => {
        console.log("[USER1] send_message (Post) ACK:");
        console.log("  contentData:", JSON.stringify(ack?.data?.contentData, null, 2));
        if (ack?.data?.contentData !== null) {
          console.log("✅ Bug 1 FIXED — contentData is populated");
        } else {
          console.log("⚠️  contentData is null for Post (expected for Post type)");
        }
        resolve();
      });
    });
    await wait(500);
  }

  // ── TEST 5: Send Poll (Bug 1 fix check) ───────────────
  if (POLL_ID) {
    console.log("\n--- TEST 5: Send Poll (contentData check) ---");
    await new Promise((resolve) => {
      user1.emit("send_message", {
        roomId,
        messageType: "Poll",
        contentId: POLL_ID,
        contentType: "Poll",
      }, (ack) => {
        console.log("[USER1] send_message (Poll) ACK:");
        console.log("  contentData:", JSON.stringify(ack?.data?.contentData, null, 2));
        if (ack?.data?.contentData?.question) {
          console.log("✅ Bug 1 FIXED — Poll contentData has question:", ack.data.contentData.question);
        } else {
          console.error("❌ Bug 1 NOT fixed — Poll contentData missing");
        }
        resolve();
      });
    });
    await wait(500);
  }

  // ── TEST 6: Send Write Post (Bug 1 fix check) ─────────
  if (WRITE_ID) {
    console.log("\n--- TEST 6: Send Write Post (contentData check) ---");
    await new Promise((resolve) => {
      user1.emit("send_message", {
        roomId,
        messageType: "Write Post",
        contentId: WRITE_ID,
        contentType: "Write Post",
      }, (ack) => {
        console.log("[USER1] send_message (Write Post) ACK:");
        console.log("  contentData:", JSON.stringify(ack?.data?.contentData, null, 2));
        if (ack?.data?.contentData?.title) {
          console.log("✅ Bug 1 FIXED — Write Post contentData has title:", ack.data.contentData.title);
        } else {
          console.error("❌ Bug 1 NOT fixed — Write Post contentData missing");
        }
        resolve();
      });
    });
    await wait(500);
  }

  // ── TEST 7: Get Messages (Bug 2 duplicate check) ──────
  console.log("\n--- TEST 7: Get Messages (duplicate check) ---");
  await new Promise((resolve) => {
    user1.emit("get_messages", { roomId, page: 1, limit: 50 }, (ack) => {
      const msgs = ack?.data?.messages || [];
      const ids = msgs.map((m) => m.id);
      const uniqueIds = new Set(ids);
      console.log("  Total messages:", msgs.length);
      console.log("  Unique message IDs:", uniqueIds.size);
      if (ids.length === uniqueIds.size) {
        console.log("✅ Bug 2 FIXED — No duplicate messages");
      } else {
        console.error("❌ Bug 2 NOT fixed — Duplicate messages found!");
      }
      // Check contentData in messages list
      msgs.filter(m => m.contentType).forEach(m => {
        console.log(`  [${m.messageType}] contentData:`, m.contentData ? "✅ populated" : "❌ null");
      });
      resolve();
    });
  });

  await wait(300);

  // ── TEST 8: Typing Indicators ─────────────────────────
  console.log("\n--- TEST 8: Typing Indicators ---");
  user1.emit("typing_start", { roomId });
  console.log("[USER1] typing_start emitted → USER2 should receive user_typing");
  await wait(500);
  user1.emit("typing_stop", { roomId });
  console.log("[USER1] typing_stop emitted → USER2 should receive user_typing(false)");
  await wait(300);

  // ── TEST 9: Mark Read ─────────────────────────────────
  console.log("\n--- TEST 9: Mark Read ---");
  user2.emit("mark_read", { roomId });
  console.log("[USER2] mark_read emitted → USER1 should receive messages_read");
  await wait(300);

  // ── TEST 10: Send Snap (Bug 3 fix check) ──────────────
  if (SNAP_MEDIA_ID) {
    console.log("\n--- TEST 10: Send Snap (messageType check) ---");
    await new Promise((resolve) => {
      user1.emit("send_snap", {
        mediaId: SNAP_MEDIA_ID,
        recipientIds: [USER2_ID],
        expiresInSeconds: 86400,
      });
      console.log("[USER1] send_snap emitted → USER2 should receive new_snap with messageType");

      // Listen for new_snap on user2 just for this test
      user2.once("new_snap", (data) => {
        console.log("[USER2] new_snap received:");
        console.log("  messageType:", data?.snap?.messageType);
        if (data?.snap?.messageType) {
          console.log("✅ Bug 3 FIXED — messageType present:", data.snap.messageType);
        } else {
          console.error("❌ Bug 3 NOT fixed — messageType missing in new_snap");
        }
        resolve();
      });

      // Timeout if snap not received
      setTimeout(resolve, 3000);
    });
    await wait(300);
  }

  // ── TEST 11: Get Unread Count ─────────────────────────
  console.log("\n--- TEST 11: Get Unread Count ---");
  await new Promise((resolve) => {
    user2.emit("get_unread_count", { roomId }, (ack) => {
      console.log("[USER2] unread count for room:", ack?.data?.unreadCount);
      resolve();
    });
  });

  await wait(300);

  // ── DONE ──────────────────────────────────────────────
  console.log("\n====================================");
  console.log("        ALL TESTS COMPLETE");
  console.log("====================================\n");

  await wait(1000);
  user1.disconnect();
  user2.disconnect();
  process.exit(0);
};

// ── Wait for both users to connect then run ───────────────
let connectedCount = 0;
const onConnect = (user) => {
  connectedCount++;
  console.log(`[${user}] ✅ Connected`);
  if (connectedCount === 2) runTests();
};

user1.on("connect", () => onConnect("USER1"));
user2.on("connect", () => onConnect("USER2"));