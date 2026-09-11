using CombinedStudies.Chat.Entities;

namespace CombinedStudies.Chat.Services;

public interface IChatService
{
    Task<Conversation> GetOrCreateConversationAsync(string userId1, string userId2);
    Task<Conversation?> GetConversationAsync(Guid convId, string userId);
    Task<List<Conversation>> GetConversationsAsync(string userId);
    Task<List<ChatMessage>> GetMessagesAsync(Guid convId, string userId);
    Task<ChatMessage?> SendMessageAsync(Guid convId, string senderId, string text);
    Task MarkReadAsync(Guid convId, string userId);
}
