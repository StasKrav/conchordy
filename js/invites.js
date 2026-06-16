function getMyInvites() {
  if (!currentUser) return [];
  return invites.filter((inv) => inv.created_by === currentUser.id);
}

function getInvitedUsers() {
  const myInvites = getMyInvites();
  const invitedIds = myInvites
    .filter((inv) => inv.used_by)
    .map((inv) => inv.used_by);
  return users.filter((u) => invitedIds.includes(u.id));
}

function getAvailableInvitesCount() {
  const invitedCount = getInvitedUsers().length;
  return 1 + invitedCount;
}

function generateInviteCode() {
  return (
    "CONCHORDY_" + Math.random().toString(36).substring(2, 10).toUpperCase()
  );
}

async function createInvite() {
  if (!currentUser) return null;
  const code = generateInviteCode();
  const success = await saveInviteToServer(code, currentUser.id);
  if (success) {
    invites.push({
      code: code,
      created_by: currentUser.id,
      used_by: null,
      used_at: null,
      created_at: Date.now(),
    });
    return code;
  }
  return null;
}
