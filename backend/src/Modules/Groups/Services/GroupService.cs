using CombinedStudies.Groups.Data;
using CombinedStudies.Groups.DTOs;
using CombinedStudies.Groups.Entities;
using CombinedStudies.Profiles.Data;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Groups.Services;

public class GroupService(GroupsDbContext db, ProfilesDbContext profiles, IGroupNotifier notifier) : IGroupService
{
    public async Task<GroupDto> CreateAsync(string userId, CreateGroupRequest req)
    {
        var color = req.Color ?? "#0d9488";
        var group = Group.Create(userId, req.Name.Trim(), req.Subject.Trim(), req.Description?.Trim() ?? "", color);
        group.Members.Add(GroupMember.Create(group.Id, userId, isAdmin: true));
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        return ToDto(group, userId);
    }

    public async Task<List<GroupDto>> GetMineAsync(string userId)
    {
        var groups = await db.Groups
            .Include(g => g.Members)
            .Where(g => g.Members.Any(m => m.UserId == userId))
            .OrderByDescending(g => g.CreatedAt)
            .ToListAsync();
        return groups.Select(g => ToDto(g, userId)).ToList();
    }

    public async Task<GroupDetailDto?> GetDetailAsync(Guid groupId, string userId)
    {
        var group = await db.Groups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group is null) return null;

        var userIds = group.Members.Select(m => m.UserId).ToList();
        var profileMap = await profiles.Profiles
            .Where(p => userIds.Contains(p.UserId))
            .Select(p => new { p.UserId, p.FirstName, p.LastName, p.ProfilePictureUrl, p.Headline })
            .ToDictionaryAsync(p => p.UserId);

        var members = group.Members
            .OrderBy(m => m.JoinedAt)
            .Select(m =>
            {
                profileMap.TryGetValue(m.UserId, out var p);
                var name = p is not null ? $"{p.FirstName} {p.LastName}".Trim() : "Unknown";
                return new GroupMemberDto(
                    m.UserId, name, p?.ProfilePictureUrl, p?.Headline,
                    m.JoinedAt, m.UserId == group.OwnerId, m.IsAdmin || m.UserId == group.OwnerId);
            })
            .ToList();

        return new GroupDetailDto(
            group.Id, group.Name, group.Subject, group.Description,
            group.Color, group.OwnerId, group.OwnerId == userId,
            members.Count, group.CreatedAt, members
        );
    }

    public async Task<List<GroupDto>> DiscoverAsync(string userId)
    {
        var myGroupIds = await db.Members
            .Where(m => m.UserId == userId)
            .Select(m => m.GroupId)
            .ToListAsync();

        var groups = await db.Groups
            .Include(g => g.Members)
            .Where(g => !myGroupIds.Contains(g.Id))
            .OrderByDescending(g => g.Members.Count)
            .Take(50)
            .ToListAsync();

        return groups.Select(g => ToDto(g, userId)).ToList();
    }

    public async Task<bool> JoinAsync(Guid groupId, string userId)
    {
        var group = await db.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null) return false;
        if (group.Members.Any(m => m.UserId == userId)) return false;
        group.Members.Add(GroupMember.Create(groupId, userId));
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<(bool Ok, string? Error)> InviteAsync(Guid groupId, string requesterId, string targetUserId)
    {
        var group = await db.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null) return (false, "Group not found.");

        var requester = group.Members.FirstOrDefault(m => m.UserId == requesterId);
        if (requester is null) return (false, "Only members can invite.");

        // Only owner or admin can invite
        if (group.OwnerId != requesterId && !requester.IsAdmin)
            return (false, "Only the owner or an admin can invite members.");

        if (group.Members.Any(m => m.UserId == targetUserId)) return (false, "User is already a member.");

        var existing = await db.Invites.AnyAsync(i =>
            i.GroupId == groupId && i.UserId == targetUserId && i.Status == GroupInviteStatus.Pending);
        if (existing) return (false, "Invite already sent.");

        var inviterProfile = await profiles.Profiles
            .Where(p => p.UserId == requesterId)
            .Select(p => new { p.FirstName, p.LastName })
            .FirstOrDefaultAsync();
        var inviterName = inviterProfile is not null
            ? $"{inviterProfile.FirstName} {inviterProfile.LastName}".Trim()
            : "A member";

        var targetProfile = await profiles.Profiles
            .Where(p => p.UserId == targetUserId)
            .Select(p => new { p.FirstName, p.LastName })
            .FirstOrDefaultAsync();
        var targetName = targetProfile is not null
            ? $"{targetProfile.FirstName} {targetProfile.LastName}".Trim()
            : "a user";

        var invite = GroupInvite.Create(groupId, group.Name, group.Color, requesterId, inviterName, targetUserId);
        db.Invites.Add(invite);

        // System message visible to all current members
        var sysInvite = GroupMessage.CreateSystem(groupId, $"Group invite sent to {targetName}");
        db.Messages.Add(sysInvite);
        await db.SaveChangesAsync();

        await notifier.SendGroupInviteAsync(
            targetUserId, invite.Id.ToString(), group.Id.ToString(),
            group.Name, group.Color, inviterName);

        // Push system message to all current members
        var currentMemberIds = group.Members.Select(m => m.UserId).ToList();
        var sysDto = new GroupMessageDto(sysInvite.Id, groupId, "system", "", null, sysInvite.Text, sysInvite.SentAt, true);
        await notifier.SendGroupMessageAsync(currentMemberIds, "system", sysDto);

        return (true, null);
    }

    public async Task<List<GroupInviteDto>> GetMyInvitesAsync(string userId)
    {
        return await db.Invites
            .Where(i => i.UserId == userId && i.Status == GroupInviteStatus.Pending)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new GroupInviteDto(i.Id, i.GroupId, i.GroupName, i.GroupColor, i.InvitedByName, i.CreatedAt))
            .ToListAsync();
    }

    public async Task<bool> RespondToInviteAsync(Guid inviteId, string userId, bool accept)
    {
        var invite = await db.Invites.FirstOrDefaultAsync(i => i.Id == inviteId && i.UserId == userId);
        if (invite is null || invite.Status != GroupInviteStatus.Pending) return false;

        var userProfile = await profiles.Profiles
            .Where(p => p.UserId == userId)
            .Select(p => new { p.FirstName, p.LastName })
            .FirstOrDefaultAsync();
        var userName = userProfile is not null
            ? $"{userProfile.FirstName} {userProfile.LastName}".Trim()
            : "Someone";

        if (accept)
        {
            var alreadyMember = await db.Members.AnyAsync(m => m.GroupId == invite.GroupId && m.UserId == userId);
            if (!alreadyMember)
                db.Members.Add(GroupMember.Create(invite.GroupId, userId));
            invite.Status = GroupInviteStatus.Accepted;

            var sysMsg = GroupMessage.CreateSystem(invite.GroupId, $"{userName} joined the group");
            db.Messages.Add(sysMsg);
            await db.SaveChangesAsync();

            // Push to all members including the new one
            var allMemberIds = await db.Members
                .Where(m => m.GroupId == invite.GroupId)
                .Select(m => m.UserId)
                .ToListAsync();
            var sysDto = new GroupMessageDto(sysMsg.Id, invite.GroupId, "system", "", null, sysMsg.Text, sysMsg.SentAt, true);
            await notifier.SendGroupMessageAsync(allMemberIds, "system", sysDto);
        }
        else
        {
            invite.Status = GroupInviteStatus.Declined;
            await db.SaveChangesAsync();
        }

        return true;
    }

    public async Task<int> CountPendingInvitesAsync(string userId) =>
        await db.Invites.CountAsync(i => i.UserId == userId && i.Status == GroupInviteStatus.Pending);

    public async Task<bool> PromoteToAdminAsync(Guid groupId, string requesterId, string targetUserId)
    {
        var group = await db.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null || group.OwnerId != requesterId) return false;
        var member = group.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (member is null) return false;
        member.IsAdmin = true;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DemoteAdminAsync(Guid groupId, string requesterId, string targetUserId)
    {
        var group = await db.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null || group.OwnerId != requesterId) return false;
        var member = group.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (member is null) return false;
        member.IsAdmin = false;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<GroupMessageDto?> SendGroupMessageAsync(Guid groupId, string senderId, string text)
    {
        var isMember = await db.Members.AnyAsync(m => m.GroupId == groupId && m.UserId == senderId);
        if (!isMember) return null;

        var msg = GroupMessage.Create(groupId, senderId, text.Trim());
        db.Messages.Add(msg);
        await db.SaveChangesAsync();

        var senderProfile = await profiles.Profiles
            .Where(p => p.UserId == senderId)
            .Select(p => new { p.FirstName, p.LastName, p.ProfilePictureUrl })
            .FirstOrDefaultAsync();
        var senderName = senderProfile is not null
            ? $"{senderProfile.FirstName} {senderProfile.LastName}".Trim()
            : "Unknown";

        var dto = new GroupMessageDto(msg.Id, groupId, senderId, senderName, senderProfile?.ProfilePictureUrl, msg.Text, msg.SentAt);

        // Push to all other members via SignalR
        var memberIds = await db.Members
            .Where(m => m.GroupId == groupId && m.UserId != senderId)
            .Select(m => m.UserId)
            .ToListAsync();

        await notifier.SendGroupMessageAsync(memberIds, senderId, dto);
        return dto;
    }

    public async Task<List<GroupMessageDto>> GetGroupMessagesAsync(Guid groupId, string userId, int take = 100)
    {
        var isMember = await db.Members.AnyAsync(m => m.GroupId == groupId && m.UserId == userId);
        if (!isMember) return [];

        var messages = await db.Messages
            .Where(m => m.GroupId == groupId)
            .OrderByDescending(m => m.SentAt)
            .Take(take)
            .ToListAsync();

        messages.Reverse();

        var senderIds = messages.Select(m => m.SenderId).Distinct().ToList();
        var profileMap = await profiles.Profiles
            .Where(p => senderIds.Contains(p.UserId))
            .Select(p => new { p.UserId, p.FirstName, p.LastName, p.ProfilePictureUrl })
            .ToDictionaryAsync(p => p.UserId);

        return messages.Select(m =>
        {
            if (m.IsSystem)
                return new GroupMessageDto(m.Id, groupId, "system", "", null, m.Text, m.SentAt, true);
            profileMap.TryGetValue(m.SenderId, out var p);
            var name = p is not null ? $"{p.FirstName} {p.LastName}".Trim() : "Unknown";
            return new GroupMessageDto(m.Id, groupId, m.SenderId, name, p?.ProfilePictureUrl, m.Text, m.SentAt);
        }).ToList();
    }

    public async Task<bool> LeaveAsync(Guid groupId, string userId)
    {
        var group = await db.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == groupId);
        if (group is null) return false;

        var member = group.Members.FirstOrDefault(m => m.UserId == userId);
        if (member is null) return false;

        var leavingProfile = await profiles.Profiles
            .Where(p => p.UserId == userId)
            .Select(p => new { p.FirstName, p.LastName })
            .FirstOrDefaultAsync();
        var leavingName = leavingProfile is not null
            ? $"{leavingProfile.FirstName} {leavingProfile.LastName}".Trim()
            : "Someone";

        var remainingIds = group.Members
            .Where(m => m.UserId != userId)
            .Select(m => m.UserId)
            .ToList();

        if (group.OwnerId == userId && group.Members.Count == 1)
        {
            // Last member — just delete silently
            db.Groups.Remove(group);
            await db.SaveChangesAsync();
        }
        else
        {
            db.Members.Remove(member);
            if (group.OwnerId == userId)
            {
                var next = group.Members.First(m => m.UserId != userId);
                await db.Groups
                    .Where(g => g.Id == groupId)
                    .ExecuteUpdateAsync(s => s.SetProperty(g => g.OwnerId, next.UserId));
            }

            // System message
            var sysMsg = GroupMessage.CreateSystem(groupId, $"{leavingName} left the group");
            db.Messages.Add(sysMsg);
            await db.SaveChangesAsync();

            var sysDto = new GroupMessageDto(sysMsg.Id, groupId, "system", "", null, sysMsg.Text, sysMsg.SentAt, true);
            await notifier.SendGroupMessageAsync(remainingIds, "system", sysDto);
        }

        return true;
    }

    public async Task<bool> DeleteAsync(Guid groupId, string userId)
    {
        var group = await db.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == groupId && g.OwnerId == userId);
        if (group is null) return false;

        var memberIds = group.Members.Select(m => m.UserId).ToList();
        db.Groups.Remove(group);
        await db.SaveChangesAsync();

        // Notify all members the group is gone
        await notifier.NotifyGroupDeletedAsync(memberIds, groupId.ToString(), group.Name);
        return true;
    }

    private static GroupDto ToDto(Group g, string userId) => new(
        g.Id, g.Name, g.Subject, g.Description, g.Color,
        g.OwnerId, g.OwnerId == userId, g.Members.Count, g.CreatedAt
    );
}
