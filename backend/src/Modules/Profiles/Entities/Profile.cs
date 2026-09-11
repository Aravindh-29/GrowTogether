namespace CombinedStudies.Profiles.Entities;

public class Profile
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string UserId { get; private set; } = "";
    public string Email { get; private set; } = "";

    // Personal info
    public string FirstName { get; private set; } = "";
    public string? MiddleName { get; private set; }
    public string LastName { get; private set; } = "";
    public DateOnly? DateOfBirth { get; private set; }
    public string? Gender { get; private set; }
    public string? Phone { get; private set; }
    public string? AlternatePhone { get; private set; }
    public string? AlternateEmail { get; private set; }
    public string? ProfilePictureUrl { get; private set; }
    public string? City { get; private set; }
    public string? Country { get; private set; }
    public string? Role { get; private set; }
    public string? Username { get; private set; }

    // Professional
    public string? Headline { get; private set; }
    public string? About { get; private set; }
    public string? Website { get; private set; }
    public string? LinkedInUrl { get; private set; }
    public string? GitHubUrl { get; private set; }
    public string? TwitterUrl { get; private set; }
    public bool IsOpenToWork { get; private set; }

    // Learning
    public string[] SubjectsKnown { get; private set; } = [];
    public string[] SubjectsWanted { get; private set; } = [];
    public string[] SubjectsCanTeach { get; private set; } = [];

    // Sub-entities
    public List<ProfileEducation> Educations { get; private set; } = [];
    public List<ProfileExperience> Experiences { get; private set; } = [];
    public List<ProfileProject> Projects { get; private set; } = [];

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    private Profile() { }

    public static Profile Create(string userId, string email, string firstName, string lastName) => new()
    {
        UserId = userId,
        Email = email,
        FirstName = firstName,
        LastName = lastName,
    };

    public void UpdatePersonal(string firstName, string? middleName, string lastName,
        DateOnly? dob, string? gender, string? phone, string? altPhone, string? altEmail,
        string? pictureUrl, string? city, string? country)
    {
        FirstName = firstName;
        MiddleName = middleName;
        LastName = lastName;
        DateOfBirth = dob;
        Gender = gender;
        Phone = phone;
        AlternatePhone = altPhone;
        AlternateEmail = altEmail;
        ProfilePictureUrl = pictureUrl;
        City = city;
        Country = country;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateProfessional(string? headline, string? about, string? website,
        string? linkedIn, string? gitHub, string? twitter, bool openToWork)
    {
        Headline = headline;
        About = about;
        Website = website;
        LinkedInUrl = linkedIn;
        GitHubUrl = gitHub;
        TwitterUrl = twitter;
        IsOpenToWork = openToWork;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateSkills(string[] known, string[] wanted, string? role = null, string[]? canTeach = null)
    {
        SubjectsKnown = known;
        SubjectsWanted = wanted;
        if (role is not null) Role = role;
        if (canTeach is not null) SubjectsCanTeach = canTeach;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetUsername(string username)
    {
        Username = username.ToLowerInvariant().Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceEducations(List<ProfileEducation> items)
    {
        Educations = items;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceExperiences(List<ProfileExperience> items)
    {
        Experiences = items;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceProjects(List<ProfileProject> items)
    {
        Projects = items;
        UpdatedAt = DateTime.UtcNow;
    }

    public int CompletionPercent()
    {
        // 15 checkpoints — each weighted; max sums to 100
        int score = 0;
        if (!string.IsNullOrWhiteSpace(FirstName) && !string.IsNullOrWhiteSpace(LastName)) score += 8;  // name
        if (!string.IsNullOrWhiteSpace(ProfilePictureUrl)) score += 10;                                 // photo
        if (!string.IsNullOrWhiteSpace(City) || !string.IsNullOrWhiteSpace(Country)) score += 5;       // location
        if (!string.IsNullOrWhiteSpace(Gender)) score += 2;                                             // gender
        if (DateOfBirth.HasValue) score += 3;                                                           // dob
        if (!string.IsNullOrWhiteSpace(Phone)) score += 3;                                              // phone
        if (!string.IsNullOrWhiteSpace(Role)) score += 5;                                               // role
        if (!string.IsNullOrWhiteSpace(Headline)) score += 8;                                           // headline
        if (!string.IsNullOrWhiteSpace(About) && About.Length >= 50) score += 8;                       // about
        var hasSocial = Website is not null || LinkedInUrl is not null || GitHubUrl is not null || TwitterUrl is not null;
        if (hasSocial) score += 5;                                                                       // social links
        if (SubjectsKnown.Length >= 2) score += 7;                                                      // skills known
        if (SubjectsWanted.Length >= 2) score += 5;                                                     // skills wanted
        if (Educations.Count > 0) score += 12;                                                          // education
        if (Experiences.Count > 0) score += 10;                                                         // experience
        if (Projects.Count > 0) score += 9;                                                             // projects
        return Math.Min(score, 100);
    }
}
