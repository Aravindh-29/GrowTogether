using CombinedStudies.Groups.DTOs;

namespace CombinedStudies.Groups.Services;

public interface IGroupNotifier
{
    Task SendGroupInviteAsync(string targetUserId, string inviteId, string groupId, string groupName, string groupColor, string invitedByName);
    Task SendGroupMessageAsync(IEnumerable<string> memberUserIds, string senderUserId, GroupMessageDto message);
    Task NotifyGroupDeletedAsync(IEnumerable<string> memberUserIds, string groupId, string groupName);
}
