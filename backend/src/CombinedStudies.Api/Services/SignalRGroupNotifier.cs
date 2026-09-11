using CombinedStudies.Api.Hubs;
using CombinedStudies.Groups.DTOs;
using CombinedStudies.Groups.Services;
using Microsoft.AspNetCore.SignalR;

namespace CombinedStudies.Api.Services;

public class SignalRGroupNotifier(IHubContext<ChatHub> hub) : IGroupNotifier
{
    public async Task SendGroupInviteAsync(
        string targetUserId, string inviteId, string groupId,
        string groupName, string groupColor, string invitedByName)
    {
        await hub.Clients
            .Group($"user:{targetUserId}")
            .SendAsync("GroupInviteReceived", new { inviteId, groupId, groupName, groupColor, invitedByName });
    }

    public async Task SendGroupMessageAsync(IEnumerable<string> memberUserIds, string senderUserId, GroupMessageDto message)
    {
        var tasks = memberUserIds.Select(uid =>
            hub.Clients.Group($"user:{uid}").SendAsync("ReceiveGroupMessage", message));
        await Task.WhenAll(tasks);
    }

    public async Task NotifyGroupDeletedAsync(IEnumerable<string> memberUserIds, string groupId, string groupName)
    {
        var tasks = memberUserIds.Select(uid =>
            hub.Clients.Group($"user:{uid}").SendAsync("GroupDeleted", new { groupId, groupName }));
        await Task.WhenAll(tasks);
    }
}
