namespace CombinedStudies.Profiles.Entities;

public class ProfileProject
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProfileId { get; private set; }
    public string Name { get; private set; } = "";
    public string? Description { get; private set; }
    public string? Url { get; private set; }
    public string[] Technologies { get; private set; } = [];

    private ProfileProject() { }

    public static ProfileProject Create(Guid profileId, string name,
        string? description, string? url, string[] technologies) => new()
    {
        ProfileId = profileId,
        Name = name,
        Description = description,
        Url = url,
        Technologies = technologies,
    };
}
