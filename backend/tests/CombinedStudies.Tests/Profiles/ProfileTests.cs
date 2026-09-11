using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CombinedStudies.Identity.DTOs;
using CombinedStudies.Profiles.DTOs;

namespace CombinedStudies.Tests.Profiles;

[Collection("Integration")]
public class ProfileTests(TestFixture fixture)
{
    private RegisterRequest UniqueRegister()
    {
        var email = $"profile_{Guid.NewGuid():N}@test.com";
        fixture.TrackEmail(email);
        return new(email, "Password123!", "Profile Tester");
    }

    private async Task<HttpClient> AuthedClientAsync()
    {
        var client = fixture.CreateClient();
        var reg  = await client.PostAsJsonAsync("/api/identity/register", UniqueRegister());
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private static UpdatePersonalRequest BasicPersonal(string first, string? middle, string last,
        string? gender = null, string? phone = null, string? city = null, string? country = null) =>
        new(FirstName: first, MiddleName: middle, LastName: last, DateOfBirth: null,
            Gender: gender, Phone: phone, AlternatePhone: null, AlternateEmail: null,
            ProfilePictureUrl: null, City: city, Country: country, Username: null);

    private static CreateProfileRequest SampleCreate() => new(
        Personal:     BasicPersonal("John", null, "Doe", gender: "Male"),
        Professional: new(null, null, null, null, null, null, false),
        Skills:       new(["Mathematics", "Physics"], ["Spanish", "French"], "Learner"),
        Educations:   [],
        Experiences:  [],
        Projects:     []
    );

    // ── Auth guard ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetMyProfile_Returns401_WithNoToken()
    {
        var client = fixture.CreateClient();
        var resp = await client.GetAsync("/api/profiles/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task CreateProfile_Returns401_WithNoToken()
    {
        var client = fixture.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/profiles", SampleCreate());
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task UpdatePersonal_Returns401_WithNoToken()
    {
        var client = fixture.CreateClient();
        var resp = await client.PatchAsJsonAsync("/api/profiles/me/personal",
            BasicPersonal("John", null, "Doe"));
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // ── No profile yet ──────────────────────────────────────────────────

    [Fact]
    public async Task GetMyProfile_Returns404_WhenNoProfileExists()
    {
        var client = await AuthedClientAsync();
        var resp = await client.GetAsync("/api/profiles/me");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task UpdateSkills_Returns404_WhenNoProfileExists()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PatchAsJsonAsync("/api/profiles/me/skills",
            new UpdateSkillsRequest(["Math"], ["Spanish"], null));
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Create ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateProfile_Returns201_WithCorrectData()
    {
        var client = await AuthedClientAsync();
        var req = SampleCreate();

        var resp = await client.PostAsJsonAsync("/api/profiles", req);
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.NotNull(body);
        Assert.Equal("John", body.FirstName);
        Assert.Equal("Doe", body.LastName);
        Assert.Equal("Male", body.Gender);
        Assert.Equal("Learner", body.Role);
        Assert.Equal(req.Skills.SubjectsKnown, body.SubjectsKnown);
        Assert.Equal(req.Skills.SubjectsWanted, body.SubjectsWanted);
        Assert.NotEqual(Guid.Empty, body.Id);
        Assert.NotEmpty(body.UserId);
    }

    [Fact]
    public async Task CreateProfile_Returns409_WhenProfileAlreadyExists()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/profiles", SampleCreate());

        var resp2 = await client.PostAsJsonAsync("/api/profiles", SampleCreate());
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task CreateProfile_AllowsEmptySkillArrays()
    {
        var client = await AuthedClientAsync();
        var req = new CreateProfileRequest(
            BasicPersonal("Jane", null, "Smith", gender: "Female"),
            new(null, null, null, null, null, null, false),
            new([], [], null),
            [], [], []
        );
        var resp = await client.PostAsJsonAsync("/api/profiles", req);
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Empty(body!.SubjectsKnown);
        Assert.Empty(body.SubjectsWanted);
    }

    [Fact]
    public async Task CreateProfile_WithEducationAndExperience_Stored()
    {
        var client = await AuthedClientAsync();
        var req = new CreateProfileRequest(
            BasicPersonal("Alex", null, "Brown"),
            new("Engineer", "I build things.", null, null, null, null, false),
            new(["Programming"], ["Data Science"], "Both"),
            [new("MIT", "B.Sc.", "Computer Science", 2018, 2022, null)],
            [new("Google", "SWE", "Full-time", "Remote", 2022, null, null, null, null)],
            [new("My App", "A cool app", null, ["React", "TypeScript"])]
        );
        var resp = await client.PostAsJsonAsync("/api/profiles", req);
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Single(body!.Educations);
        Assert.Equal("MIT", body.Educations[0].School);
        Assert.Single(body.Experiences);
        Assert.Equal("Google", body.Experiences[0].Company);
        Assert.Single(body.Projects);
        Assert.Equal("My App", body.Projects[0].Name);
    }

    // ── Get after create ────────────────────────────────────────────────

    [Fact]
    public async Task GetMyProfile_Returns200_AfterCreating()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/profiles", SampleCreate());

        var resp = await client.GetAsync("/api/profiles/me");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.NotNull(body);
        Assert.Equal("John", body.FirstName);
        Assert.Equal("Doe", body.LastName);
    }

    // ── Section updates ─────────────────────────────────────────────────

    [Fact]
    public async Task UpdatePersonal_Returns200_WithUpdatedData()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/profiles", SampleCreate());

        var update = new UpdatePersonalRequest(
            FirstName: "Jane", MiddleName: "M", LastName: "Doe", DateOfBirth: null,
            Gender: "Female", Phone: "+44 7700 123456", AlternatePhone: null, AlternateEmail: null,
            ProfilePictureUrl: null, City: "London", Country: "UK", Username: null);
        var resp = await client.PatchAsJsonAsync("/api/profiles/me/personal", update);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Equal("Jane", body!.FirstName);
        Assert.Equal("Female", body.Gender);
        Assert.Equal("M", body.MiddleName);
        Assert.Equal("London", body.City);
        Assert.Equal("UK", body.Country);
    }

    [Fact]
    public async Task UpdateSkills_Returns200_WithUpdatedData()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/profiles", SampleCreate());

        var update = new UpdateSkillsRequest(["Programming", "Data Science"], ["Music", "Art & Design"], "Tutor");
        var resp = await client.PatchAsJsonAsync("/api/profiles/me/skills", update);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Equal(["Programming", "Data Science"], body!.SubjectsKnown);
        Assert.Equal(["Music", "Art & Design"], body.SubjectsWanted);
        Assert.Equal("Tutor", body.Role);
    }

    [Fact]
    public async Task UpdateSkills_GetMe_ReflectsChanges()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/profiles", SampleCreate());
        await client.PatchAsJsonAsync("/api/profiles/me/skills",
            new UpdateSkillsRequest(["Chemistry"], ["Law"], "Learner"));

        var resp = await client.GetAsync("/api/profiles/me");
        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Equal(["Chemistry"], body!.SubjectsKnown);
        Assert.Equal(["Law"], body.SubjectsWanted);
    }

    [Fact]
    public async Task UpdateEducations_ReplacesEntries()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/profiles", SampleCreate());

        var resp = await client.PatchAsJsonAsync("/api/profiles/me/educations",
            new UpdateEducationsRequest([new("Harvard", "MBA", "Business", 2023, null, null)]));
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Single(body!.Educations);
        Assert.Equal("Harvard", body.Educations[0].School);
    }

    // ── Isolation ───────────────────────────────────────────────────────

    [Fact]
    public async Task TwoUsers_HaveSeparateProfiles()
    {
        var client1 = await AuthedClientAsync();
        var client2 = await AuthedClientAsync();

        await client1.PostAsJsonAsync("/api/profiles", new CreateProfileRequest(
            BasicPersonal("Alice", null, "A"),
            new(null, null, null, null, null, null, false),
            new(["Math"], ["Spanish"], "Learner"), [], [], []));

        await client2.PostAsJsonAsync("/api/profiles", new CreateProfileRequest(
            BasicPersonal("Bob", null, "B"),
            new(null, null, null, null, null, null, false),
            new(["Music"], ["Physics"], "Tutor"), [], [], []));

        var p1 = await (await client1.GetAsync("/api/profiles/me")).Content.ReadFromJsonAsync<ProfileResponse>();
        var p2 = await (await client2.GetAsync("/api/profiles/me")).Content.ReadFromJsonAsync<ProfileResponse>();

        Assert.Equal("Alice", p1!.FirstName);
        Assert.Equal("Bob",   p2!.FirstName);
        Assert.NotEqual(p1.UserId, p2.UserId);
    }

    // ── Completion percent ───────────────────────────────────────────────

    [Fact]
    public async Task CompletionPercent_IncreasesAsProfileFilled()
    {
        var client = await AuthedClientAsync();
        var create = await client.PostAsJsonAsync("/api/profiles", SampleCreate());
        var initial = await create.Content.ReadFromJsonAsync<ProfileResponse>();

        var withHeadline = await (await client.PatchAsJsonAsync("/api/profiles/me/professional",
            new UpdateProfessionalRequest("Software Engineer", "I love coding and learning.", null, null, null, null, false)))
            .Content.ReadFromJsonAsync<ProfileResponse>();

        Assert.True(withHeadline!.CompletionPercent > initial!.CompletionPercent);
    }
}
