using System.Collections.Concurrent;
using System.Security.Claims;
using CombinedStudies.Groups.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Api.Hubs;

[Authorize]
public class ChatHub(GroupsDbContext groupsDb) : Hub
{
    // ── Online presence ────────────────────────────────────────────────────────
    private static readonly ConcurrentDictionary<string, int> _connections = new();

    public static bool IsOnline(string userId) => _connections.ContainsKey(userId);

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is not null)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
            var count = _connections.AddOrUpdate(userId, 1, (_, c) => c + 1);
            if (count == 1)
                await Clients.All.SendAsync("UserOnline", userId);
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is not null)
        {
            var count = _connections.AddOrUpdate(userId, 0, (_, c) => Math.Max(0, c - 1));
            if (count == 0)
            {
                _connections.TryRemove(userId, out _);
                await Clients.All.SendAsync("UserOffline", userId);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }

    // ── 1-to-1 call signaling ─────────────────────────────────────────────────

    public async Task InitiateCall(string targetUserId, bool isVideo, string callerName)
    {
        var callerId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId is null) return;
        await Clients.Group($"user:{targetUserId}").SendAsync("IncomingCall", new {
            CallerId = callerId,
            CallerName = callerName,
            IsVideo = isVideo
        });
    }

    public async Task AcceptCall(string callerId)
    {
        var acceptorId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"user:{callerId}").SendAsync("CallAccepted", new { AcceptorId = acceptorId });
    }

    public async Task SendOffer(string targetUserId, string sdp)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("ReceiveOffer", new { Sdp = sdp });
    }

    public async Task SendAnswer(string targetUserId, string sdp)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("ReceiveAnswer", new { Sdp = sdp });
    }

    public async Task SendIceCandidate(string targetUserId, string candidate)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("ReceiveIceCandidate", new { Candidate = candidate });
    }

    public async Task RejectCall(string callerId)
    {
        await Clients.Group($"user:{callerId}").SendAsync("CallRejected");
    }

    public async Task EndCall(string targetUserId)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("CallEnded");
    }

    public async Task TypingDm(string targetUserId, string senderName)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("UserTypingDm", new { senderName });
    }

    // ── Upgrade 1-to-1 buddy call → group call ────────────────────────────────
    // Called by the person who wants to add a third buddy to an ongoing buddy call.
    // Backend generates a temp group ID and notifies all three parties.
    public async Task UpgradeBuddyCallToGroup(string otherUserId, string inviteeUserId, string callerName, bool isVideo)
    {
        var callerId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId is null) return;
        var tempGroupId = $"buddy-{Guid.NewGuid():N}";
        // Tell current call partner to upgrade
        await Clients.Group($"user:{otherUserId}").SendAsync("UpgradeToGroupCall",
            new { tempGroupId, isVideo });
        // Invite the new person
        await Clients.Group($"user:{inviteeUserId}").SendAsync("IncomingGroupCall",
            new { callerId, callerName, groupId = tempGroupId, groupName = "Group Call", isVideo });
        // Tell caller to upgrade
        await Clients.Caller.SendAsync("UpgradeToGroupCall", new { tempGroupId, isVideo });
    }

    // ── Group call signaling ──────────────────────────────────────────────────
    // groupId -> { userId -> displayName }
    private static readonly ConcurrentDictionary<string, Dictionary<string, string>> _groupCallParticipants = new();
    // groupId -> locked
    private static readonly ConcurrentDictionary<string, bool> _lockedGroupCalls = new();
    // groupId -> set of userIds who raised hand
    private static readonly ConcurrentDictionary<string, HashSet<string>> _raisedHands = new();
    // groupId -> first-joiner userId (the call host)
    private static readonly ConcurrentDictionary<string, string> _groupCallHosts = new();

    public static bool IsGroupCallActive(string groupId) =>
        _groupCallParticipants.ContainsKey(groupId);

    public async Task InitiateGroupCall(string groupId, bool isVideo, string callerName)
    {
        var callerId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId is null) return;

        var parsedId = Guid.TryParse(groupId, out var gid) ? gid : (Guid?)null;
        if (parsedId is null) return;

        var group = await groupsDb.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == parsedId);
        if (group is null) return;

        var memberIds = group.Members
            .Select(m => m.UserId)
            .Where(uid => uid != callerId)
            .ToList();

        foreach (var uid in memberIds)
            await Clients.Group($"user:{uid}").SendAsync("IncomingGroupCall",
                new { callerId, callerName, groupId, groupName = group.Name, isVideo });
    }

    public async Task JoinGroupCall(string groupId, string displayName)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;

        if (_lockedGroupCalls.ContainsKey(groupId))
        {
            await Clients.Caller.SendAsync("GroupCallJoinDenied", new { groupId, reason = "locked" });
            return;
        }

        var participants = _groupCallParticipants.GetOrAdd(groupId, _ => new Dictionary<string, string>());
        Dictionary<string, string> existing;
        lock (participants) { existing = new Dictionary<string, string>(participants); participants[userId] = displayName; }
        // First joiner becomes the call host
        _groupCallHosts.TryAdd(groupId, userId);
        await Clients.Caller.SendAsync("GroupCallParticipantList",
            new { groupId, participants = existing.Select(p => new { userId = p.Key, name = p.Value }).ToArray(), isHost = _groupCallHosts.TryGetValue(groupId, out var hid) && hid == userId });
        foreach (var pid in existing.Keys)
            await Clients.Group($"user:{pid}").SendAsync("GroupCallParticipantJoined",
                new { groupId, participantId = userId, participantName = displayName });
    }

    public async Task LeaveGroupCall(string groupId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;
        if (!_groupCallParticipants.TryGetValue(groupId, out var participants)) return;
        string[] remaining;
        lock (participants) { participants.Remove(userId); remaining = participants.Keys.ToArray(); }
        if (remaining.Length == 0)
        {
            _groupCallParticipants.TryRemove(groupId, out _);
            await BroadcastCallEnded(groupId);
        }
        else
        {
            if (_raisedHands.TryGetValue(groupId, out var hands))
                lock (hands) { hands.Remove(userId); }
            foreach (var pid in remaining)
                await Clients.Group($"user:{pid}").SendAsync("GroupCallParticipantLeft",
                    new { groupId, participantId = userId });
        }
    }

    // Broadcasts GroupCallEnded to all group members and cleans up tracking state
    private async Task BroadcastCallEnded(string groupId)
    {
        _lockedGroupCalls.TryRemove(groupId, out _);
        _raisedHands.TryRemove(groupId, out _);
        _groupCallHosts.TryRemove(groupId, out _);
        if (!Guid.TryParse(groupId, out var gid)) return;
        var memberIds = await groupsDb.Groups
            .Where(g => g.Id == gid)
            .SelectMany(g => g.Members.Select(m => m.UserId))
            .ToListAsync();
        foreach (var mid in memberIds)
            await Clients.Group($"user:{mid}").SendAsync("GroupCallEnded", new { groupId });
    }

    public async Task EndGroupCallForAll(string groupId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;
        if (!_groupCallParticipants.TryGetValue(groupId, out var participants)) return;
        // Verify the caller is actually in the call
        bool isInCall;
        lock (participants) { isInCall = participants.ContainsKey(userId); }
        if (!isInCall) return;
        // Remove all participants and broadcast
        _groupCallParticipants.TryRemove(groupId, out var allParticipants);
        string[] allPids = [];
        if (allParticipants is not null)
            lock (allParticipants) { allPids = allParticipants.Keys.ToArray(); }
        // Tell everyone currently in the call to dismiss their call UI
        foreach (var pid in allPids)
            await Clients.Group($"user:{pid}").SendAsync("GroupCallEndedForAll", new { groupId });
        await BroadcastCallEnded(groupId);
    }

    // ── WebRTC mesh signaling (group) ─────────────────────────────────────────

    public async Task SendGroupOffer(string groupId, string targetUserId, string sdp)
    {
        var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"user:{targetUserId}").SendAsync("ReceiveGroupOffer",
            new { groupId, senderId, sdp });
    }

    public async Task SendGroupAnswer(string groupId, string targetUserId, string sdp)
    {
        var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"user:{targetUserId}").SendAsync("ReceiveGroupAnswer",
            new { groupId, senderId, sdp });
    }

    public async Task SendGroupIceCandidate(string groupId, string targetUserId, string candidate)
    {
        var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        await Clients.Group($"user:{targetUserId}").SendAsync("ReceiveGroupIceCandidate",
            new { groupId, senderId, candidate });
    }

    // ── Group call host controls ──────────────────────────────────────────────

    public async Task MuteGroupParticipant(string targetUserId, string groupId)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("GroupCallMuteRequested",
            new { groupId });
    }

    public async Task MuteAllGroupParticipants(string groupId)
    {
        var callerId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!_groupCallParticipants.TryGetValue(groupId, out var participants)) return;
        string[] others;
        lock (participants) { others = participants.Keys.Where(uid => uid != callerId).ToArray(); }
        foreach (var uid in others)
            await Clients.Group($"user:{uid}").SendAsync("GroupCallMuteRequested", new { groupId });
    }

    public async Task RemoveFromGroupCall(string groupId, string targetUserId)
    {
        await Clients.Group($"user:{targetUserId}").SendAsync("RemovedFromGroupCall",
            new { groupId });
        if (_groupCallParticipants.TryGetValue(groupId, out var participants))
        {
            string[] remaining;
            lock (participants) { participants.Remove(targetUserId); remaining = participants.Keys.ToArray(); }
            if (remaining.Length == 0)
            {
                _groupCallParticipants.TryRemove(groupId, out _);
                _lockedGroupCalls.TryRemove(groupId, out _);
                _raisedHands.TryRemove(groupId, out _);
            }
            else
            {
                if (_raisedHands.TryGetValue(groupId, out var hands))
                    lock (hands) { hands.Remove(targetUserId); }
            }
            foreach (var pid in remaining)
                await Clients.Group($"user:{pid}").SendAsync("GroupCallParticipantLeft",
                    new { groupId, participantId = targetUserId });
        }
    }

    public async Task LockGroupCall(string groupId)
    {
        _lockedGroupCalls.TryAdd(groupId, true);
        if (_groupCallParticipants.TryGetValue(groupId, out var p))
        {
            string[] uids;
            lock (p) { uids = p.Keys.ToArray(); }
            foreach (var uid in uids)
                await Clients.Group($"user:{uid}").SendAsync("GroupCallLocked", new { groupId });
        }
    }

    public async Task UnlockGroupCall(string groupId)
    {
        _lockedGroupCalls.TryRemove(groupId, out _);
        if (_groupCallParticipants.TryGetValue(groupId, out var p))
        {
            string[] uids;
            lock (p) { uids = p.Keys.ToArray(); }
            foreach (var uid in uids)
                await Clients.Group($"user:{uid}").SendAsync("GroupCallUnlocked", new { groupId });
        }
    }

    // ── Raise hand ────────────────────────────────────────────────────────────

    public async Task RaiseHand(string groupId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;
        var hands = _raisedHands.GetOrAdd(groupId, _ => new HashSet<string>());
        lock (hands) { hands.Add(userId); }
        if (_groupCallParticipants.TryGetValue(groupId, out var p))
        {
            string[] uids;
            lock (p) { uids = p.Keys.ToArray(); }
            foreach (var uid in uids)
                await Clients.Group($"user:{uid}").SendAsync("GroupCallHandRaised",
                    new { groupId, userId });
        }
    }

    public async Task LowerHand(string groupId)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;
        if (_raisedHands.TryGetValue(groupId, out var hands))
            lock (hands) { hands.Remove(userId); }
        if (_groupCallParticipants.TryGetValue(groupId, out var p))
        {
            string[] uids;
            lock (p) { uids = p.Keys.ToArray(); }
            foreach (var uid in uids)
                await Clients.Group($"user:{uid}").SendAsync("GroupCallHandLowered",
                    new { groupId, userId });
        }
    }

    // Host can lower someone else's raised hand
    public async Task LowerParticipantHand(string groupId, string targetUserId)
    {
        var callerId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerId is null) return;
        if (!_groupCallParticipants.TryGetValue(groupId, out var p)) return;
        // Only participants in the call can do this (host check is enforced via UI)
        bool isInCall;
        lock (p) { isInCall = p.ContainsKey(callerId); }
        if (!isInCall) return;
        if (_raisedHands.TryGetValue(groupId, out var hands))
            lock (hands) { hands.Remove(targetUserId); }
        string[] uids;
        lock (p) { uids = p.Keys.ToArray(); }
        foreach (var uid in uids)
            await Clients.Group($"user:{uid}").SendAsync("GroupCallHandLowered",
                new { groupId, userId = targetUserId });
    }

    // ── Video mute signaling ──────────────────────────────────────────────────

    public async Task UpdateVideoMute(string groupId, bool muted)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return;
        if (!_groupCallParticipants.TryGetValue(groupId, out var p)) return;
        string[] uids;
        lock (p) { uids = p.Keys.ToArray(); }
        foreach (var uid in uids)
            await Clients.Group($"user:{uid}").SendAsync("GroupCallVideoMuteChanged",
                new { groupId, userId, muted });
    }

    // ── Reactions (emoji float) ───────────────────────────────────────────────

    public async Task SendCallReaction(string groupId, string emoji)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!_groupCallParticipants.TryGetValue(groupId, out var p)) return;
        var name = p.TryGetValue(userId!, out var n) ? n : "User";
        string[] uids;
        lock (p) { uids = p.Keys.ToArray(); }
        foreach (var uid in uids)
            await Clients.Group($"user:{uid}").SendAsync("GroupCallReaction",
                new { groupId, userId, name, emoji });
    }

    // ── In-call chat ──────────────────────────────────────────────────────────

    public async Task SendCallChatMessage(string groupId, string message)
    {
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!_groupCallParticipants.TryGetValue(groupId, out var p)) return;
        var name = p.TryGetValue(userId!, out var n) ? n : "User";
        string[] uids;
        lock (p) { uids = p.Keys.ToArray(); }
        var ts = DateTime.UtcNow.ToString("o");
        foreach (var uid in uids)
            await Clients.Group($"user:{uid}").SendAsync("GroupCallChatMessage",
                new { groupId, userId, name, message, timestamp = ts });
    }
}
