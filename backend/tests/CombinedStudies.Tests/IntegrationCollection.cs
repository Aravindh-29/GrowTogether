using Microsoft.AspNetCore.Mvc.Testing;

namespace CombinedStudies.Tests;

[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<WebApplicationFactory<Program>> { }
