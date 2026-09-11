using System.ComponentModel.DataAnnotations;
using CombinedStudies.Connections.Entities;

namespace CombinedStudies.Connections.DTOs;

public record SendRequestDto(
    [Required] string ReceiverId,
    [MaxLength(300)] string? Note
);

public record ConnectionDto(
    Guid Id,
    string SenderId,
    string ReceiverId,
    ConnectionStatus Status,
    string? Note,
    DateTime SentAt,
    DateTime? RespondedAt
);

public record ConnectionWithProfileDto(
    Guid ConnectionId,
    string UserId,
    string? Username,
    string Name,
    string? ProfilePictureUrl,
    string? Role,
    string? Headline,
    string? City,
    string? Country,
    ConnectionStatus Status,
    string? Note,
    DateTime SentAt,
    DateTime? RespondedAt,
    bool IsSender
);
