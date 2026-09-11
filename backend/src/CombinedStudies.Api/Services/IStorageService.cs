namespace CombinedStudies.Api.Services;

public interface IStorageService
{
    Task<string> UploadAsync(Stream data, string objectName, string contentType, long size);
    string PublicUrl(string objectName);
}
