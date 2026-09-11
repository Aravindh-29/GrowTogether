using System.ComponentModel.DataAnnotations;

namespace CombinedStudies.Groups.DTOs;

public record CreateGroupRequest(
    [Required, MaxLength(60)] string Name,
    [Required, MaxLength(60)] string Subject,
    [MaxLength(200)] string? Description,
    [MaxLength(20)]  string? Color
);

public record InviteRequest([Required, MaxLength(64)] string UserId);

public record GroupInviteDto(
    Guid     Id,
    Guid     GroupId,
    string   GroupName,
    string   GroupColor,
    string   InvitedByName,
    DateTime CreatedAt
);

public record RespondInviteRequest([Required] bool Accept);

public record GroupDto(
    Guid     Id,
    string   Name,
    string   Subject,
    string   Description,
    string   Color,
    string   OwnerId,
    bool     IsOwner,
    int      MemberCount,
    DateTime CreatedAt
);

public record GroupMemberDto(
    string  UserId,
    string  DisplayName,
    string? ProfilePictureUrl,
    string? Headline,
    DateTime JoinedAt,
    bool    IsOwner,
    bool    IsAdmin
);

public record GroupMessageDto(
    Guid     Id,
    Guid     GroupId,
    string   SenderId,
    string   SenderName,
    string?  SenderPictureUrl,
    string   Text,
    DateTime SentAt,
    bool     IsSystem = false
);

public record SendGroupMessageRequest([Required, MaxLength(4000)] string Text);

public record PromoteRequest([Required, MaxLength(64)] string UserId);

public record GroupDetailDto(
    Guid     Id,
    string   Name,
    string   Subject,
    string   Description,
    string   Color,
    string   OwnerId,
    bool     IsOwner,
    int      MemberCount,
    DateTime CreatedAt,
    List<GroupMemberDto> Members
);
