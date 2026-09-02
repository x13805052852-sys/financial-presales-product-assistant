import assert from "node:assert/strict";
import test from "node:test";

import { createSessionKey } from "./session-key.js";

test("creates a stable opaque key for the same group user", () => {
  const first = createSessionKey({ chatType: "group", chatId: "group-1", userId: "user-1" });
  const second = createSessionKey({ chatType: "group", chatId: "group-1", userId: "user-1" });

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(first, /group-1|user-1/u);
});

test("isolates users, groups and single chats", () => {
  const groupUserOne = createSessionKey({
    chatType: "group",
    chatId: "group-1",
    userId: "user-1",
  });
  const groupUserTwo = createSessionKey({
    chatType: "group",
    chatId: "group-1",
    userId: "user-2",
  });
  const otherGroup = createSessionKey({
    chatType: "group",
    chatId: "group-2",
    userId: "user-1",
  });
  const single = createSessionKey({ chatType: "single", userId: "user-1" });

  assert.equal(new Set([groupUserOne, groupUserTwo, otherGroup, single]).size, 4);
});

test("requires a group id for group messages", () => {
  assert.throws(
    () => createSessionKey({ chatType: "group", userId: "user-1" }),
    /chatId/u,
  );
});
