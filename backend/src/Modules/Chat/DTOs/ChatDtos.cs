using System.ComponentModel.DataAnnotations;

namespace CombinedStudies.Chat.DTOs;

public record StartConversationDto([Required] string UserId);

public record SendMessageDto([Required, MaxLength(4000)] string Text);

public record ConversationSummaryDto(
    Guid Id,
    string OtherUserId,
    string? OtherUsername,
    string OtherName,
    string? OtherPicture,
    string? LastMessage,
    DateTime? LastMessageAt,
    int UnreadCount
);

public record MessageDto(
    Guid Id,
    Guid ConversationId,
    string SenderId,
    string Text,
    DateTime SentAt,
    DateTime? ReadAt
);
