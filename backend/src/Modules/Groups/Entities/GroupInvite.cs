namespace CombinedStudies.Groups.Entities;

public enum GroupInviteStatus { Pending, Accepted, Declined }

public class GroupInvite
{
    public Guid   Id              { get; private set; } = Guid.NewGuid();
    public Guid   GroupId         { get; private set; }
    public string GroupName       { get; private set; } = "";
    public string GroupColor      { get; private set; } = "#0d9488";
    public string InvitedByUserId { get; private set; } = "";
    public string InvitedByName   { get; private set; } = "";
    public string UserId          { get; private set; } = "";
    public GroupInviteStatus Status { get; set; } = GroupInviteStatus.Pending;
    public DateTime CreatedAt     { get; private set; } = DateTime.UtcNow;

    public static GroupInvite Create(Guid groupId, string groupName, string groupColor,
        string invitedByUserId, string invitedByName, string targetUserId) => new()
    {
        GroupId         = groupId,
        GroupName       = groupName,
        GroupColor      = groupColor,
        InvitedByUserId = invitedByUserId,
        InvitedByName   = invitedByName,
        UserId          = targetUserId,
    };
}
