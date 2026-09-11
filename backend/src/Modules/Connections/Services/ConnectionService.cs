using CombinedStudies.Connections.Data;
using CombinedStudies.Connections.DTOs;
using CombinedStudies.Connections.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Connections.Services;

public class ConnectionService(ConnectionsDbContext db) : IConnectionService
{
    public async Task<ConnectionDto?> SendRequestAsync(string senderId, string receiverId, string? note)
    {
        // block self-request
        if (senderId == receiverId) return null;

        // block if any connection already exists in either direction
        var exists = await db.Connections.AnyAsync(c =>
            (c.SenderId == senderId && c.ReceiverId == receiverId) ||
            (c.SenderId == receiverId && c.ReceiverId == senderId));
        if (exists) return null;

        var conn = Connection.Create(senderId, receiverId, note);
        db.Connections.Add(conn);
        await db.SaveChangesAsync();
        return ToDto(conn);
    }

    public async Task<ConnectionDto?> AcceptAsync(Guid connectionId, string userId)
    {
        var conn = await db.Connections.FindAsync(connectionId);
        if (conn is null || conn.ReceiverId != userId || conn.Status != ConnectionStatus.Pending) return null;
        conn.Accept();
        await db.SaveChangesAsync();
        return ToDto(conn);
    }

    public async Task<ConnectionDto?> RejectAsync(Guid connectionId, string userId)
    {
        var conn = await db.Connections.FindAsync(connectionId);
        if (conn is null || conn.ReceiverId != userId || conn.Status != ConnectionStatus.Pending) return null;
        conn.Reject();
        await db.SaveChangesAsync();
        return ToDto(conn);
    }

    public async Task<bool> CancelAsync(Guid connectionId, string userId)
    {
        var conn = await db.Connections.FindAsync(connectionId);
        if (conn is null) return false;
        if (conn.SenderId != userId && conn.ReceiverId != userId) return false;
        db.Connections.Remove(conn);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<ConnectionDto>> GetConnectionsAsync(string userId) =>
        (await db.Connections
            .Where(c => (c.SenderId == userId || c.ReceiverId == userId) && c.Status == ConnectionStatus.Accepted)
            .ToListAsync())
            .Select(ToDto).ToList();

    public async Task<List<ConnectionDto>> GetIncomingRequestsAsync(string userId) =>
        (await db.Connections
            .Where(c => c.ReceiverId == userId && c.Status == ConnectionStatus.Pending)
            .OrderByDescending(c => c.SentAt)
            .ToListAsync())
            .Select(ToDto).ToList();

    public async Task<List<ConnectionDto>> GetSentRequestsAsync(string userId) =>
        (await db.Connections
            .Where(c => c.SenderId == userId && c.Status == ConnectionStatus.Pending)
            .OrderByDescending(c => c.SentAt)
            .ToListAsync())
            .Select(ToDto).ToList();

    public async Task<ConnectionDto?> GetBetweenAsync(string userId1, string userId2)
    {
        var conn = await db.Connections.FirstOrDefaultAsync(c =>
            (c.SenderId == userId1 && c.ReceiverId == userId2) ||
            (c.SenderId == userId2 && c.ReceiverId == userId1));
        return conn is null ? null : ToDto(conn);
    }

    private static ConnectionDto ToDto(Connection c) =>
        new(c.Id, c.SenderId, c.ReceiverId, c.Status, c.Note, c.SentAt, c.RespondedAt);
}
