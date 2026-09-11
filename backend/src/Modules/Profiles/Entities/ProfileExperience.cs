namespace CombinedStudies.Profiles.Entities;

public class ProfileExperience
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProfileId { get; private set; }
    public string Company { get; private set; } = "";
    public string Title { get; private set; } = "";
    public string? EmploymentType { get; private set; }
    public string? Location { get; private set; }
    public int StartYear { get; private set; }
    public int? StartMonth { get; private set; }
    public int? EndYear { get; private set; }
    public int? EndMonth { get; private set; }
    public string? Description { get; private set; }

    private ProfileExperience() { }

    public static ProfileExperience Create(Guid profileId, string company, string title,
        string? employmentType, string? location,
        int startYear, int? startMonth, int? endYear, int? endMonth,
        string? description) => new()
    {
        ProfileId = profileId,
        Company = company,
        Title = title,
        EmploymentType = employmentType,
        Location = location,
        StartYear = startYear,
        StartMonth = startMonth,
        EndYear = endYear,
        EndMonth = endMonth,
        Description = description,
    };
}
