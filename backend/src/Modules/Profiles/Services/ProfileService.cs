using CombinedStudies.Profiles.Data;
using CombinedStudies.Profiles.DTOs;
using CombinedStudies.Profiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Profiles.Services;

public class ProfileService(ProfilesDbContext db) : IProfileService
{
    public async Task<ProfileResponse?> GetByUserIdAsync(string userId)
    {
        var p = await LoadAsync(userId);
        return p is null ? null : ToResponse(p);
    }

    public async Task<ProfileResponse> CreateAsync(string userId, string email, string displayName, CreateProfileRequest req)
    {
        // Split displayName into first/last if personal names not provided
        var names = displayName.Trim().Split(' ', 2);
        var firstName = req.Personal.FirstName.Trim() is { Length: > 0 } fn ? fn : names[0];
        var lastName  = req.Personal.LastName.Trim()  is { Length: > 0 } ln ? ln : (names.Length > 1 ? names[1] : names[0]);

        var profile = Profile.Create(userId, email, firstName, lastName);

        profile.UpdatePersonal(firstName, req.Personal.MiddleName, lastName,
            req.Personal.DateOfBirth, req.Personal.Gender, req.Personal.Phone,
            req.Personal.AlternatePhone, req.Personal.AlternateEmail,
            req.Personal.ProfilePictureUrl, req.Personal.City, req.Personal.Country);

        if (!string.IsNullOrWhiteSpace(req.Personal.Username))
            profile.SetUsername(req.Personal.Username);

        profile.UpdateProfessional(req.Professional.Headline, req.Professional.About,
            req.Professional.Website, req.Professional.LinkedInUrl,
            req.Professional.GitHubUrl, req.Professional.TwitterUrl, req.Professional.IsOpenToWork);

        profile.UpdateSkills(req.Skills.SubjectsKnown, req.Skills.SubjectsWanted, req.Skills.Role, req.Skills.SubjectsCanTeach);
        profile.ReplaceEducations(req.Educations.Select(e => ProfileEducation.Create(profile.Id, e.School, e.Degree, e.FieldOfStudy, e.StartYear, e.EndYear, e.Description)).ToList());
        profile.ReplaceExperiences(req.Experiences.Select(e => ProfileExperience.Create(profile.Id, e.Company, e.Title, e.EmploymentType, e.Location, e.StartYear, e.StartMonth, e.EndYear, e.EndMonth, e.Description)).ToList());
        profile.ReplaceProjects(req.Projects.Select(p => ProfileProject.Create(profile.Id, p.Name, p.Description, p.Url, p.Technologies)).ToList());

        db.Profiles.Add(profile);
        await db.SaveChangesAsync();
        return ToResponse(profile);
    }

    public async Task<ProfileResponse?> UpdatePersonalAsync(string userId, UpdatePersonalRequest req)
    {
        var p = await LoadAsync(userId);
        if (p is null) return null;
        p.UpdatePersonal(req.FirstName, req.MiddleName, req.LastName, req.DateOfBirth, req.Gender, req.Phone, req.AlternatePhone, req.AlternateEmail, req.ProfilePictureUrl, req.City, req.Country);
        if (req.Username is not null)
            p.SetUsername(req.Username);
        await db.SaveChangesAsync();
        return ToResponse(p);
    }

    public async Task<ProfileResponse?> UpdateProfessionalAsync(string userId, UpdateProfessionalRequest req)
    {
        var p = await LoadAsync(userId);
        if (p is null) return null;
        p.UpdateProfessional(req.Headline, req.About, req.Website, req.LinkedInUrl, req.GitHubUrl, req.TwitterUrl, req.IsOpenToWork);
        await db.SaveChangesAsync();
        return ToResponse(p);
    }

    public async Task<ProfileResponse?> UpdateSkillsAsync(string userId, UpdateSkillsRequest req)
    {
        var p = await LoadAsync(userId);
        if (p is null) return null;
        p.UpdateSkills(req.SubjectsKnown, req.SubjectsWanted, req.Role, req.SubjectsCanTeach);
        await db.SaveChangesAsync();
        return ToResponse(p);
    }

    public async Task<ProfileResponse?> UpdateEducationsAsync(string userId, UpdateEducationsRequest req)
    {
        var p = await LoadAsync(userId);
        if (p is null) return null;
        db.Educations.RemoveRange(p.Educations);
        await db.SaveChangesAsync();
        var items = req.Items.Select(e => ProfileEducation.Create(p.Id, e.School, e.Degree, e.FieldOfStudy, e.StartYear, e.EndYear, e.Description)).ToList();
        await db.Educations.AddRangeAsync(items);
        await db.SaveChangesAsync();
        p.ReplaceEducations(items);
        return ToResponse(p);
    }

    public async Task<ProfileResponse?> UpdateExperiencesAsync(string userId, UpdateExperiencesRequest req)
    {
        var p = await LoadAsync(userId);
        if (p is null) return null;
        db.Experiences.RemoveRange(p.Experiences);
        await db.SaveChangesAsync();
        var items = req.Items.Select(e => ProfileExperience.Create(p.Id, e.Company, e.Title, e.EmploymentType, e.Location, e.StartYear, e.StartMonth, e.EndYear, e.EndMonth, e.Description)).ToList();
        await db.Experiences.AddRangeAsync(items);
        await db.SaveChangesAsync();
        p.ReplaceExperiences(items);
        return ToResponse(p);
    }

    public async Task<ProfileResponse?> UpdateProjectsAsync(string userId, UpdateProjectsRequest req)
    {
        var p = await LoadAsync(userId);
        if (p is null) return null;
        db.Projects.RemoveRange(p.Projects);
        await db.SaveChangesAsync();
        var items = req.Items.Select(pr => ProfileProject.Create(p.Id, pr.Name, pr.Description, pr.Url, pr.Technologies)).ToList();
        await db.Projects.AddRangeAsync(items);
        await db.SaveChangesAsync();
        p.ReplaceProjects(items);
        return ToResponse(p);
    }

    private Task<Profile?> LoadAsync(string userId) =>
        db.Profiles
          .Include(p => p.Educations)
          .Include(p => p.Experiences)
          .Include(p => p.Projects)
          .FirstOrDefaultAsync(p => p.UserId == userId);

    private static ProfileResponse ToResponse(Profile p) => new(
        p.Id, p.UserId, p.Email,
        p.FirstName, p.MiddleName, p.LastName,
        p.DateOfBirth, p.Gender, p.Phone, p.AlternatePhone, p.AlternateEmail,
        p.ProfilePictureUrl, p.City, p.Country,
        p.Role,
        p.Username,
        p.Headline, p.About, p.Website, p.LinkedInUrl, p.GitHubUrl, p.TwitterUrl, p.IsOpenToWork,
        p.SubjectsKnown, p.SubjectsWanted, p.SubjectsCanTeach,
        p.Educations.Select(e  => new EducationResponse(e.Id, e.School, e.Degree, e.FieldOfStudy, e.StartYear, e.EndYear, e.Description)).ToList(),
        p.Experiences.Select(e => new ExperienceResponse(e.Id, e.Company, e.Title, e.EmploymentType, e.Location, e.StartYear, e.StartMonth, e.EndYear, e.EndMonth, e.Description)).ToList(),
        p.Projects.Select(pr   => new ProjectResponse(pr.Id, pr.Name, pr.Description, pr.Url, pr.Technologies)).ToList(),
        p.CompletionPercent(),
        p.CreatedAt
    );
}
