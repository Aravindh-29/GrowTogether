using System.ComponentModel.DataAnnotations;

namespace CombinedStudies.Profiles.DTOs;

// ── Sub-entity DTOs ──────────────────────────────────────────────────────

public record EducationDto(
    [MaxLength(200)] string School,
    [MaxLength(100)] string? Degree,
    [MaxLength(100)] string? FieldOfStudy,
    int? StartYear,
    int? EndYear,
    [MaxLength(1000)] string? Description
);

public record ExperienceDto(
    [MaxLength(200)] string Company,
    [MaxLength(200)] string Title,
    [MaxLength(50)]  string? EmploymentType,
    [MaxLength(200)] string? Location,
    int StartYear, int? StartMonth,
    int? EndYear, int? EndMonth,
    [MaxLength(2000)] string? Description
);

public record ProjectDto(
    [MaxLength(200)] string Name,
    [MaxLength(2000)] string? Description,
    [MaxLength(500)]  string? Url,
    string[] Technologies
);

// ── Section update requests ──────────────────────────────────────────────

public record UpdatePersonalRequest(
    [Required, MaxLength(100)] string FirstName,
    [MaxLength(100)] string? MiddleName,
    [Required, MaxLength(100)] string LastName,
    DateOnly? DateOfBirth,
    [MaxLength(30)]  string? Gender,
    [MaxLength(30)]  string? Phone,
    [MaxLength(30)]  string? AlternatePhone,
    [MaxLength(200)] string? AlternateEmail,
    string?          ProfilePictureUrl,
    [MaxLength(100)] string? City,
    [MaxLength(100)] string? Country,
    [MaxLength(30)]  string? Username
);

public record UpdateProfessionalRequest(
    [MaxLength(220)]  string? Headline,
    [MaxLength(2600)] string? About,
    [MaxLength(500)]  string? Website,
    [MaxLength(500)]  string? LinkedInUrl,
    [MaxLength(500)]  string? GitHubUrl,
    [MaxLength(500)]  string? TwitterUrl,
    bool IsOpenToWork
);

public record UpdateSkillsRequest(
    string[] SubjectsKnown,
    string[] SubjectsWanted,
    [MaxLength(20)] string? Role,
    string[]? SubjectsCanTeach = null
);

public record UpdateEducationsRequest(List<EducationDto> Items);
public record UpdateExperiencesRequest(List<ExperienceDto> Items);
public record UpdateProjectsRequest(List<ProjectDto> Items);

// ── Full create (initial setup) ──────────────────────────────────────────

public record CreateProfileRequest(
    UpdatePersonalRequest Personal,
    UpdateProfessionalRequest Professional,
    UpdateSkillsRequest Skills,
    List<EducationDto> Educations,
    List<ExperienceDto> Experiences,
    List<ProjectDto> Projects
);

// ── Response ─────────────────────────────────────────────────────────────

public record EducationResponse(Guid Id, string School, string? Degree, string? FieldOfStudy, int? StartYear, int? EndYear, string? Description);
public record ExperienceResponse(Guid Id, string Company, string Title, string? EmploymentType, string? Location, int StartYear, int? StartMonth, int? EndYear, int? EndMonth, string? Description);
public record ProjectResponse(Guid Id, string Name, string? Description, string? Url, string[] Technologies);

public record ProfileResponse(
    Guid Id,
    string UserId,
    string Email,
    string FirstName,
    string? MiddleName,
    string LastName,
    DateOnly? DateOfBirth,
    string? Gender,
    string? Phone,
    string? AlternatePhone,
    string? AlternateEmail,
    string? ProfilePictureUrl,
    string? City,
    string? Country,
    string? Role,
    string? Username,
    string? Headline,
    string? About,
    string? Website,
    string? LinkedInUrl,
    string? GitHubUrl,
    string? TwitterUrl,
    bool IsOpenToWork,
    string[] SubjectsKnown,
    string[] SubjectsWanted,
    string[] SubjectsCanTeach,
    List<EducationResponse> Educations,
    List<ExperienceResponse> Experiences,
    List<ProjectResponse> Projects,
    int CompletionPercent,
    DateTime CreatedAt
);
