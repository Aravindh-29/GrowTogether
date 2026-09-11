using CombinedStudies.Posts.DTOs;

namespace CombinedStudies.Posts.Services;

public interface IPostService
{
    Task<PostDto?> GetByIdAsync(Guid postId, string myUserId);
    Task<PostFeedResponse> GetFeedAsync(int page, int pageSize, string myUserId);
    Task<List<PostDto>> GetMyPostsAsync(string userId);
    Task<PostDto?> CreateAsync(string userId, CreatePostRequest req);
    Task<PostDto?> UpdateAsync(Guid id, string userId, UpdatePostRequest req);
    Task<bool> DeleteAsync(Guid id, string userId);
    Task<PostDto?> ToggleLikeAsync(Guid id, string userId);
    Task<PostDto?> ToggleRepostAsync(Guid id, string userId);
    Task<List<PostCommentDto>> GetCommentsAsync(Guid postId);
    Task<PostCommentDto?> AddCommentAsync(Guid postId, string userId, string content);
    Task<bool> DeleteCommentAsync(Guid commentId, string userId);
    Task<PostDto?> ToggleReactionAsync(Guid id, string userId, string type);
    Task<PostDto?> ToggleSaveAsync(Guid id, string userId);
    Task<PostFeedResponse> GetSavedAsync(string userId, int page, int pageSize);
    Task<PostDto?> VotePollAsync(Guid postId, string userId, int optionIndex);
    Task<List<PostReactionUserDto>> GetReactionsAsync(Guid postId);
    Task<List<PostActivityDto>> GetActivityAsync(string userId, int limit);
    Task MarkActivityReadAsync(string userId);
    Task<int> GetUnreadActivityCountAsync(string userId);
}
