using CombinedStudies.Profiles.DTOs;

namespace CombinedStudies.Profiles.Services;

public interface IProfileService
{
    Task<ProfileResponse?> GetByUserIdAsync(string userId);
    Task<ProfileResponse> CreateAsync(string userId, string email, string displayName, CreateProfileRequest request);
    Task<ProfileResponse?> UpdatePersonalAsync(string userId, UpdatePersonalRequest request);
    Task<ProfileResponse?> UpdateProfessionalAsync(string userId, UpdateProfessionalRequest request);
    Task<ProfileResponse?> UpdateSkillsAsync(string userId, UpdateSkillsRequest request);
    Task<ProfileResponse?> UpdateEducationsAsync(string userId, UpdateEducationsRequest request);
    Task<ProfileResponse?> UpdateExperiencesAsync(string userId, UpdateExperiencesRequest request);
    Task<ProfileResponse?> UpdateProjectsAsync(string userId, UpdateProjectsRequest request);
}
