namespace CombinedStudies.Profiles.Entities;

public class ProfileEducation
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProfileId { get; private set; }
    public string School { get; private set; } = "";
    public string? Degree { get; private set; }
    public string? FieldOfStudy { get; private set; }
    public int? StartYear { get; private set; }
    public int? EndYear { get; private set; }
    public string? Description { get; private set; }

    private ProfileEducation() { }

    public static ProfileEducation Create(Guid profileId, string school, string? degree,
        string? fieldOfStudy, int? startYear, int? endYear, string? description) => new()
    {
        ProfileId = profileId,
        School = school,
        Degree = degree,
        FieldOfStudy = fieldOfStudy,
        StartYear = startYear,
        EndYear = endYear,
        Description = description,
    };
}
