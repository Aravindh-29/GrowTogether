using CombinedStudies.Groups.DTOs;

namespace CombinedStudies.Groups.Services;

public interface IGroupService
{
    Task<GroupDto>       CreateAsync(string userId, CreateGroupRequest req);
    Task<List<GroupDto>> GetMineAsync(string userId);
    Task<GroupDetailDto?> GetDetailAsync(Guid groupId, string userId);
    Task<List<GroupDto>> DiscoverAsync(string userId);
    Task<bool>               JoinAsync(Guid groupId, string userId);
    Task<(bool Ok, string? Error)> InviteAsync(Guid groupId, string requesterId, string targetUserId);
    Task<List<GroupInviteDto>> GetMyInvitesAsync(string userId);
    Task<bool>               RespondToInviteAsync(Guid inviteId, string userId, bool accept);
    Task<bool>               PromoteToAdminAsync(Guid groupId, string requesterId, string targetUserId);
    Task<bool>               DemoteAdminAsync(Guid groupId, string requesterId, string targetUserId);
    Task<GroupMessageDto?>   SendGroupMessageAsync(Guid groupId, string senderId, string text);
    Task<List<GroupMessageDto>> GetGroupMessagesAsync(Guid groupId, string userId, int take = 100);
    Task<bool>               LeaveAsync(Guid groupId, string userId);
    Task<bool>               DeleteAsync(Guid groupId, string userId);
    Task<int>                CountPendingInvitesAsync(string userId);
}
