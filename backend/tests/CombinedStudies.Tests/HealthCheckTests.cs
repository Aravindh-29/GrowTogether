namespace CombinedStudies.Tests;

[Collection("Integration")]
public class HealthCheckTests(TestFixture fixture)
{
    [Fact]
    public async Task HealthEndpoint_Returns200()
    {
        var response = await fixture.CreateClient().GetAsync("/health");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RootEndpoint_ReturnsApiInfo()
    {
        var response = await fixture.CreateClient().GetAsync("/api");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("CombinedStudies API", body);
    }
}
