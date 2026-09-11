namespace CombinedStudies.Groups.Entities;

public class Group
{
    public Guid   Id          { get; private set; } = Guid.NewGuid();
    public string Name        { get; private set; } = "";
    public string Subject     { get; private set; } = "";
    public string Description { get; private set; } = "";
    public string Color       { get; private set; } = "#0d9488";
    public string OwnerId     { get; private set; } = "";
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public List<GroupMember> Members { get; private set; } = [];

    private Group() { }

    public static Group Create(string ownerId, string name, string subject, string description, string color) => new()
    {
        OwnerId     = ownerId,
        Name        = name,
        Subject     = subject,
        Description = description,
        Color       = color,
    };

    public void Update(string name, string subject, string description)
    {
        Name        = name;
        Subject     = subject;
        Description = description;
    }
}
