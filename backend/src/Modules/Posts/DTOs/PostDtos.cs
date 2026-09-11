namespace CombinedStudies.Posts.DTOs;

public record CreatePostRequest(
    string Content,
    List<string>? ImageUrls = null,
    string? DocumentUrl = null,
    string? DocumentName = null,
    string? PollQuestion = null,
    List<string>? PollOptions = null,
    DateTime? ScheduledAt = null,
    string? Audience = null,
    string? CommentVisibility = null
);

public record UpdatePostRequest(
    string Content,
    List<string>? ImageUrls = null,
    string? DocumentUrl = null,
    string? DocumentName = null,
    string? PollQuestion = null,
    List<string>? PollOptions = null,
    DateTime? ScheduledAt = null,
    string? Audience = null,
    string? CommentVisibility = null
);

public record CreateCommentRequest(string Content);

public record PostDto(
    Guid Id,
    string AuthorId,
    string AuthorName,
    string? AuthorAvatar,
    string? AuthorHeadline,
    string Content,
    List<string> ImageUrls,
    string? DocumentUrl,
    string? DocumentName,
    string? PollQuestion,
    List<string> PollOptions,
    DateTime? ScheduledAt,
    string Audience,
    string CommentVisibility,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int LikesCount,
    bool LikedByMe,
    int CommentsCount,
    int RepostsCount,
    bool RepostedByMe,
    int AgreeCount,
    int DisagreeCount,
    bool AgreedByMe,
    bool DisagreedByMe,
    bool SavedByMe,
    List<int> PollVoteCounts,
    int? MyPollVote
);

public record PostCommentDto(
    Guid Id,
    Guid PostId,
    string AuthorId,
    string AuthorName,
    string? AuthorAvatar,
    string Content,
    DateTime CreatedAt
);

public record PostFeedResponse(List<PostDto> Items, int Total, int Page, int PageSize);

public record PostReactionUserDto(string UserId, string Name, string? Avatar, string Type);

public record PostActivityDto(
    Guid Id,
    Guid PostId,
    string ActorId,
    string ActorName,
    string? ActorAvatar,
    string Type,
    string? ExtraText,
    bool IsRead,
    DateTime CreatedAt
);
