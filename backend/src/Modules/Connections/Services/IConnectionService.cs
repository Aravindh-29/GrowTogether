using CombinedStudies.Connections.DTOs;
using CombinedStudies.Connections.Entities;

namespace CombinedStudies.Connections.Services;

public interface IConnectionService
{
    Task<ConnectionDto?> SendRequestAsync(string senderId, string receiverId, string? note);
    Task<ConnectionDto?> AcceptAsync(Guid connectionId, string userId);
    Task<ConnectionDto?> RejectAsync(Guid connectionId, string userId);
    Task<bool> CancelAsync(Guid connectionId, string userId);
    Task<List<ConnectionDto>> GetConnectionsAsync(string userId);
    Task<List<ConnectionDto>> GetIncomingRequestsAsync(string userId);
    Task<List<ConnectionDto>> GetSentRequestsAsync(string userId);
    Task<ConnectionDto?> GetBetweenAsync(string userId1, string userId2);
}
