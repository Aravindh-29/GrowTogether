namespace CombinedStudies.Groups.Entities;

public class GroupMember
{
    public Guid     Id         { get; private set; } = Guid.NewGuid();
    public Guid     GroupId    { get; private set; }
    public string   UserId     { get; private set; } = "";
    public bool     IsAdmin    { get; set; }
    public DateTime JoinedAt   { get; private set; } = DateTime.UtcNow;

    private GroupMember() { }

    public static GroupMember Create(Guid groupId, string userId, bool isAdmin = false) => new()
    {
        GroupId = groupId,
        UserId  = userId,
        IsAdmin = isAdmin,
    };
}
