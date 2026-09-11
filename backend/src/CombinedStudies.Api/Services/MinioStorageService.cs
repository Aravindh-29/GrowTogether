using Minio;
using Minio.DataModel.Args;

namespace CombinedStudies.Api.Services;

public class MinioStorageService(IMinioClient minio, IConfiguration config) : IStorageService
{
    private readonly string _bucket = config["MinIO:Bucket"] ?? "combinedstudies";
    private readonly string _publicUrl = config["MinIO:PublicUrl"] ?? "http://localhost:9000";

    public async Task<string> UploadAsync(Stream data, string objectName, string contentType, long size)
    {
        await EnsureBucketAsync();

        await minio.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucket)
            .WithObject(objectName)
            .WithStreamData(data)
            .WithObjectSize(size)
            .WithContentType(contentType));

        return objectName;
    }

    public string PublicUrl(string objectName) =>
        $"{_publicUrl.TrimEnd('/')}/{_bucket}/{objectName}";

    private async Task EnsureBucketAsync()
    {
        var exists = await minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucket));
        if (!exists)
        {
            await minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucket));
            // Set public read policy so files are accessible without auth
            var policy = $$"""
                {
                    "Version":"2012-10-17",
                    "Statement":[{
                        "Effect":"Allow",
                        "Principal":{"AWS":["*"]},
                        "Action":["s3:GetObject"],
                        "Resource":["arn:aws:s3:::{{_bucket}}/*"]
                    }]
                }
                """;
            await minio.SetPolicyAsync(new SetPolicyArgs().WithBucket(_bucket).WithPolicy(policy));
        }
    }
}
