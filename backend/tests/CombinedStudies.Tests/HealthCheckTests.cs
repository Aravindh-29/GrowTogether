using Microsoft.AspNetCore.Mvc.Testing;

namespace CombinedStudies.Tests;

[Collection("Integration")]
public class HealthCheckTests(WebApplicationFactory<Program> factory)
{
    [Fact]
    public async Task HealthEndpoint_Returns200()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RootEndpoint_ReturnsApiInfo()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("CombinedStudies API", body);
    }
}
