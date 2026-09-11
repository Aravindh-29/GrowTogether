using CombinedStudies.Api.Services;

namespace CombinedStudies.Tests;

/// <summary>
/// In-memory storage stub — avoids needing a live MinIO instance during tests.
/// </summary>
public class FakeStorageService : IStorageService
{
    private const string Base = "http://fake-storage/test-bucket";

    public Task<string> UploadAsync(Stream data, string objectName, string contentType, long size)
        => Task.FromResult(objectName);

    public string PublicUrl(string objectName) => $"{Base}/{objectName}";
}
