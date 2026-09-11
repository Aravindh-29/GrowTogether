using CombinedStudies.Chat.Data;
using CombinedStudies.Chat.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Chat.Services;

public class ChatService(ChatDbContext db) : IChatService
{
    public async Task<Conversation> GetOrCreateConversationAsync(string userId1, string userId2)
    {
        var (u1, u2) = string.Compare(userId1, userId2, StringComparison.Ordinal) < 0
            ? (userId1, userId2) : (userId2, userId1);

        var existing = await db.Conversations.FirstOrDefaultAsync(c => c.User1Id == u1 && c.User2Id == u2);
        if (existing is not null) return existing;

        var conv = Conversation.Create(userId1, userId2);
        db.Conversations.Add(conv);
        await db.SaveChangesAsync();
        return conv;
    }

    public async Task<Conversation?> GetConversationAsync(Guid convId, string userId)
    {
        var conv = await db.Conversations.Include(c => c.Messages).FirstOrDefaultAsync(c => c.Id == convId);
        if (conv is null || (conv.User1Id != userId && conv.User2Id != userId)) return null;
        return conv;
    }

    public async Task<List<Conversation>> GetConversationsAsync(string userId) =>
        await db.Conversations
            .Where(c => c.User1Id == userId || c.User2Id == userId)
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
            .ToListAsync();

    public async Task<List<ChatMessage>> GetMessagesAsync(Guid convId, string userId)
    {
        var conv = await db.Conversations.FirstOrDefaultAsync(c => c.Id == convId);
        if (conv is null || (conv.User1Id != userId && conv.User2Id != userId)) return [];
        return await db.Messages
            .Where(m => m.ConversationId == convId)
            .OrderBy(m => m.SentAt)
            .ToListAsync();
    }

    public async Task<ChatMessage?> SendMessageAsync(Guid convId, string senderId, string text, Guid? postId = null)
    {
        var conv = await db.Conversations.FindAsync(convId);
        if (conv is null || (conv.User1Id != senderId && conv.User2Id != senderId)) return null;

        var msg = ChatMessage.Create(convId, senderId, text, postId);
        db.Messages.Add(msg);
        conv.UpdateLastMessage(text);
        await db.SaveChangesAsync();
        return msg;
    }

    public async Task MarkReadAsync(Guid convId, string userId)
    {
        var conv = await db.Conversations.FirstOrDefaultAsync(c => c.Id == convId);
        if (conv is null || (conv.User1Id != userId && conv.User2Id != userId)) return;

        var unread = await db.Messages
            .Where(m => m.ConversationId == convId && m.SenderId != userId && m.ReadAt == null)
            .ToListAsync();
        foreach (var m in unread) m.MarkRead();
        await db.SaveChangesAsync();
    }
}
