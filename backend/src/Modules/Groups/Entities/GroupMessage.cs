namespace CombinedStudies.Groups.Entities;

public class GroupMessage
{
    public Guid     Id        { get; private set; } = Guid.NewGuid();
    public Guid     GroupId   { get; private set; }
    public string   SenderId  { get; private set; } = "";
    public string   Text      { get; private set; } = "";
    public DateTime SentAt    { get; private set; } = DateTime.UtcNow;
    public bool     IsSystem  { get; private set; }

    private GroupMessage() { }

    public static GroupMessage Create(Guid groupId, string senderId, string text) => new()
    {
        GroupId  = groupId,
        SenderId = senderId,
        Text     = text,
    };

    public static GroupMessage CreateSystem(Guid groupId, string text) => new()
    {
        GroupId  = groupId,
        SenderId = "system",
        Text     = text,
        IsSystem = true,
    };
}
