using System.Security.Claims;
using CombinedStudies.Connections.Data;
using CombinedStudies.Connections.Entities;
using CombinedStudies.Profiles.Data;
using CombinedStudies.Profiles.DTOs;
using CombinedStudies.Profiles.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles").WithTags("Profiles").RequireAuthorization();

        group.MapGet("/me", async (ClaimsPrincipal user, IProfileService svc) =>
        {
            var profile = await svc.GetByUserIdAsync(UserId(user));
            return profile is null ? Results.NotFound() : Results.Ok(profile);
        }).WithName("GetMyProfile").WithOpenApi();

        group.MapPost("/", async (
            [FromBody] CreateProfileRequest req,
            ClaimsPrincipal user,
            IProfileService svc) =>
        {
            if (await svc.GetByUserIdAsync(UserId(user)) is not null)
                return Results.Conflict(new { error = "Profile already exists." });

            var email       = user.FindFirstValue(ClaimTypes.Email) ?? "";
            var displayName = user.FindFirstValue(ClaimTypes.Name)  ?? "";
            var profile = await svc.CreateAsync(UserId(user), email, displayName, req);
            return Results.Created("/api/profiles/me", profile);
        }).WithName("CreateProfile").WithOpenApi();

        group.MapPatch("/me/personal", async ([FromBody] UpdatePersonalRequest req, ClaimsPrincipal user, IProfileService svc) =>
        {
            var result = await svc.UpdatePersonalAsync(UserId(user), req);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithName("UpdatePersonal").WithOpenApi();

        group.MapPatch("/me/professional", async ([FromBody] UpdateProfessionalRequest req, ClaimsPrincipal user, IProfileService svc) =>
        {
            var result = await svc.UpdateProfessionalAsync(UserId(user), req);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithName("UpdateProfessional").WithOpenApi();

        group.MapPatch("/me/skills", async ([FromBody] UpdateSkillsRequest req, ClaimsPrincipal user, IProfileService svc) =>
        {
            var result = await svc.UpdateSkillsAsync(UserId(user), req);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithName("UpdateSkills").WithOpenApi();

        group.MapPatch("/me/educations", async ([FromBody] UpdateEducationsRequest req, ClaimsPrincipal user, IProfileService svc) =>
        {
            var result = await svc.UpdateEducationsAsync(UserId(user), req);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithName("UpdateEducations").WithOpenApi();

        group.MapPatch("/me/experiences", async ([FromBody] UpdateExperiencesRequest req, ClaimsPrincipal user, IProfileService svc) =>
        {
            var result = await svc.UpdateExperiencesAsync(UserId(user), req);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithName("UpdateExperiences").WithOpenApi();

        group.MapPatch("/me/projects", async ([FromBody] UpdateProjectsRequest req, ClaimsPrincipal user, IProfileService svc) =>
        {
            var result = await svc.UpdateProjectsAsync(UserId(user), req);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).WithName("UpdateProjects").WithOpenApi();

        // Smart suggested profiles — bidirectional skill matching with fuzzy support + pagination
        group.MapGet("/suggested", async (
            ClaimsPrincipal user,
            ProfilesDbContext db,
            ConnectionsDbContext connDb,
            int page = 1,
            int pageSize = 12,
            string? tab = null,        // "teach" | "learn" | "study" | null=all
            string? skill = null) =>   // filter by a specific skill name
        {
            var myUserId = UserId(user);
            var me = await db.Profiles.FirstOrDefaultAsync(p => p.UserId == myUserId);

            if (me is null ||
                (me.SubjectsWanted.Length == 0 && me.SubjectsKnown.Length == 0 && me.SubjectsCanTeach.Length == 0))
                return Results.Ok(new { items = Array.Empty<object>(), total = 0, page, pageSize });

            var myWanted  = me.SubjectsWanted.Select(s => s.Trim().ToLower()).ToArray();
            var myTeaches = me.SubjectsKnown.Concat(me.SubjectsCanTeach)
                              .Select(s => s.Trim().ToLower()).Distinct().ToArray();

            var acceptedBuddyIds = await connDb.Connections
                .Where(c => c.Status == ConnectionStatus.Accepted &&
                            (c.SenderId == myUserId || c.ReceiverId == myUserId))
                .Select(c => c.SenderId == myUserId ? c.ReceiverId : c.SenderId)
                .ToListAsync();

            var candidates = await db.Profiles
                .Where(p => p.UserId != myUserId && !acceptedBuddyIds.Contains(p.UserId))
                .ToListAsync();

            // Score and collect all matches
            var allScored = candidates
                .Select(p =>
                {
                    var (score, reasons) = ScoreProfile(p, myWanted, myTeaches);
                    return (profile: p, score, reasons);
                })
                .Where(x => x.score > 0)
                .OrderByDescending(x => x.score)
                .ThenByDescending(x => x.profile.CompletionPercent())
                .ToList();

            // Tab filter
            allScored = tab switch
            {
                "teach" => allScored.Where(x => x.reasons.Any(r => r.StartsWith("Wants ", StringComparison.OrdinalIgnoreCase))).ToList(),
                "learn" => allScored.Where(x => x.reasons.Any(r => r.StartsWith("Teaches ", StringComparison.OrdinalIgnoreCase))).ToList(),
                "study" => allScored.Where(x => x.reasons.Any(r => r.StartsWith("Also learning ", StringComparison.OrdinalIgnoreCase))).ToList(),
                _       => allScored
            };

            // Skill filter
            if (!string.IsNullOrWhiteSpace(skill))
            {
                var sl = skill.Trim().ToLower();
                allScored = allScored
                    .Where(x => x.reasons.Any(r => r.ToLower().Contains(sl)))
                    .ToList();
            }

            var total = allScored.Count;
            var clampedPage = Math.Max(1, page);
            var clampedSize = Math.Clamp(pageSize, 1, 50);
            var paged = allScored.Skip((clampedPage - 1) * clampedSize).Take(clampedSize).ToList();

            if (paged.Count == 0)
                return Results.Ok(new { items = Array.Empty<object>(), total, page = clampedPage, pageSize = clampedSize });

            var resultIds = paged.Select(x => x.profile.UserId).ToList();
            var conns = await connDb.Connections
                .Where(c => (c.SenderId == myUserId || c.ReceiverId == myUserId) &&
                            (resultIds.Contains(c.SenderId) || resultIds.Contains(c.ReceiverId)))
                .ToListAsync();

            var items = paged.Select(x =>
            {
                var conn = conns.FirstOrDefault(c =>
                    (c.SenderId == myUserId && c.ReceiverId == x.profile.UserId) ||
                    (c.ReceiverId == myUserId && c.SenderId == x.profile.UserId));
                return (object)new {
                    x.profile.Id, x.profile.UserId, x.profile.Username,
                    x.profile.FirstName, x.profile.MiddleName, x.profile.LastName,
                    x.profile.ProfilePictureUrl, x.profile.City, x.profile.Country,
                    x.profile.Role, x.profile.Headline, x.profile.IsOpenToWork,
                    SubjectsKnown     = x.profile.SubjectsKnown,
                    SubjectsWanted    = x.profile.SubjectsWanted,
                    CompletionPercent = x.profile.CompletionPercent(),
                    MatchScore        = x.score,
                    MatchReasons      = x.reasons,
                    ConnectionStatus  = conn?.Status.ToString() ?? "None",
                    ConnectionId      = conn?.Id,
                    IsSender          = conn?.SenderId == myUserId,
                };
            }).ToList();

            return Results.Ok(new { items, total, page = clampedPage, pageSize = clampedSize });
        }).WithName("GetSuggestedProfiles").WithOpenApi();

        // Public profile view — no sensitive fields (email, phone, alternate contact)
        group.MapGet("/{userId}", async (string userId, ClaimsPrincipal user, IProfileService svc, ConnectionsDbContext connDb) =>
        {
            var profile = await svc.GetByUserIdAsync(userId);
            if (profile is null) return Results.NotFound();

            var myUserId = UserId(user);
            var conn = await connDb.Connections.FirstOrDefaultAsync(c =>
                (c.SenderId == myUserId && c.ReceiverId == userId) ||
                (c.SenderId == userId && c.ReceiverId == myUserId));

            return Results.Ok(new {
                profile.Id, profile.UserId, profile.Username,
                profile.FirstName, profile.MiddleName, profile.LastName,
                profile.ProfilePictureUrl, profile.City, profile.Country,
                profile.Role, profile.Headline, profile.About,
                profile.Website, profile.LinkedInUrl, profile.GitHubUrl, profile.TwitterUrl,
                profile.IsOpenToWork,
                SubjectsKnown = profile.SubjectsKnown,
                SubjectsWanted = profile.SubjectsWanted,
                profile.Educations, profile.Experiences, profile.Projects,
                profile.CompletionPercent,
                ConnectionStatus = conn?.Status.ToString() ?? "None",
                ConnectionId = conn?.Id,
                IsSender = conn?.SenderId == myUserId,
            });
        }).WithName("GetPublicProfile").WithOpenApi();

        // Check username availability
        group.MapGet("/check-username", async (string username, ProfilesDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(username) || username.Length < 3 || username.Length > 30)
                return Results.BadRequest(new { available = false, error = "Username must be 3–30 characters." });
            var normalized = username.ToLowerInvariant().Trim();
            var taken = await db.Profiles.AnyAsync(p => p.Username == normalized);
            return Results.Ok(new { available = !taken });
        }).AllowAnonymous();

        // Search profiles — cursor-based pagination for scale
        group.MapGet("/search", async (
            string? q,
            string? role,
            string? skill,
            [FromQuery] string[]? countries,
            string? cursor,
            ClaimsPrincipal user,
            ProfilesDbContext db,
            ConnectionsDbContext connDb,
            int pageSize = 20) =>
        {
            var myUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var clampedSize = Math.Clamp(pageSize, 1, 50);
            var query = db.Profiles.Where(p => p.UserId != myUserId);

            if (!string.IsNullOrWhiteSpace(q))
            {
                var ql = q.Trim().ToLower();
                var usernameQ = ql.StartsWith("@") ? ql[1..] : ql;
                query = query.Where(p =>
                    p.FirstName.ToLower().Contains(ql) ||
                    p.LastName.ToLower().Contains(ql) ||
                    (p.Username != null && p.Username.Contains(usernameQ)) ||
                    p.Email.ToLower() == ql ||
                    (p.Headline != null && p.Headline.ToLower().Contains(ql)) ||
                    (p.City != null && p.City.ToLower().Contains(ql)) ||
                    p.SubjectsKnown.Any(s => EF.Functions.ILike(s, "%" + ql + "%")) ||
                    p.SubjectsWanted.Any(s => EF.Functions.ILike(s, "%" + ql + "%")));
            }
            if (!string.IsNullOrWhiteSpace(role))
                query = query.Where(p => p.Role == role);
            if (countries is { Length: > 0 })
                query = query.Where(p => p.Country != null && countries.Contains(p.Country));

            query = query.OrderBy(p => p.FirstName).ThenBy(p => p.Id);

            // Fuzzy skill filter: fetch DB candidates then apply Levenshtein in C#
            // This handles typos like ansible→ansble, devops→davops without a DB extension
            if (!string.IsNullOrWhiteSpace(skill))
            {
                var sl = skill.Trim().ToLower();
                var candidates = await query.Take(500).ToListAsync();
                var matched = candidates
                    .Where(p => p.SubjectsKnown.Concat(p.SubjectsWanted)
                        .Any(s => FuzzySkillSearch(s.Trim().ToLower(), sl)))
                    .ToList();

                // Integer offset cursor for skill results
                var offset = !string.IsNullOrWhiteSpace(cursor) && int.TryParse(cursor, out var off) ? off : 0;
                var hasMoreSkill = matched.Count > offset + clampedSize;
                var pageFuzzy = matched.Skip(offset).Take(clampedSize).ToList();
                var nextCursorSkill = hasMoreSkill ? (offset + clampedSize).ToString() : null;

                if (pageFuzzy.Count == 0)
                    return Results.Ok(new { items = new List<object>(), hasMore = false, nextCursor = (string?)null });

                var fuzzyUserIds = pageFuzzy.Select(p => p.UserId).ToList();
                var fuzzyConns = await connDb.Connections
                    .Where(c => (c.SenderId == myUserId || c.ReceiverId == myUserId) &&
                                (fuzzyUserIds.Contains(c.SenderId) || fuzzyUserIds.Contains(c.ReceiverId)))
                    .ToListAsync();

                var fuzzyItems = pageFuzzy.Select(p =>
                {
                    var conn = fuzzyConns.FirstOrDefault(c =>
                        (c.SenderId == myUserId && c.ReceiverId == p.UserId) ||
                        (c.ReceiverId == myUserId && c.SenderId == p.UserId));
                    return (object)new {
                        p.Id, p.UserId, p.Username,
                        p.FirstName, p.MiddleName, p.LastName,
                        p.ProfilePictureUrl, p.City, p.Country,
                        p.Role, p.Headline, p.IsOpenToWork,
                        SubjectsKnown     = p.SubjectsKnown,
                        SubjectsWanted    = p.SubjectsWanted,
                        CompletionPercent = p.CompletionPercent(),
                        ConnectionStatus  = conn?.Status.ToString() ?? "None",
                        ConnectionId      = conn?.Id,
                        IsSender          = conn?.SenderId == myUserId,
                    };
                }).ToList();

                return Results.Ok(new { items = fuzzyItems, hasMore = hasMoreSkill, nextCursor = nextCursorSkill });
            }

            // No skill filter — UUID cursor-based pagination
            if (!string.IsNullOrWhiteSpace(cursor) && Guid.TryParse(cursor, out var cursorGuid))
            {
                var cursorProfile = await db.Profiles.FindAsync(cursorGuid);
                if (cursorProfile is not null)
                {
                    var cn = cursorProfile.FirstName;
                    var ci = cursorProfile.Id;
                    query = query.Where(p =>
                        p.FirstName.CompareTo(cn) > 0 ||
                        (p.FirstName == cn && p.Id.CompareTo(ci) > 0));
                }
            }

            var results = await query.Take(clampedSize + 1).ToListAsync();
            var hasMore = results.Count > clampedSize;
            if (hasMore) results = results.Take(clampedSize).ToList();
            var nextCursor = hasMore ? results.Last().Id.ToString() : null;

            if (results.Count == 0)
                return Results.Ok(new { items = new List<object>(), hasMore = false, nextCursor = (string?)null });

            var resultUserIds = results.Select(p => p.UserId).ToList();
            var myConns = await connDb.Connections
                .Where(c => (c.SenderId == myUserId || c.ReceiverId == myUserId) &&
                            (resultUserIds.Contains(c.SenderId) || resultUserIds.Contains(c.ReceiverId)))
                .ToListAsync();

            var items = results.Select(p =>
            {
                var conn = myConns.FirstOrDefault(c =>
                    (c.SenderId == myUserId && c.ReceiverId == p.UserId) ||
                    (c.ReceiverId == myUserId && c.SenderId == p.UserId));
                return (object)new {
                    p.Id, p.UserId, p.Username,
                    p.FirstName, p.MiddleName, p.LastName,
                    p.ProfilePictureUrl, p.City, p.Country,
                    p.Role, p.Headline, p.IsOpenToWork,
                    SubjectsKnown     = p.SubjectsKnown,
                    SubjectsWanted    = p.SubjectsWanted,
                    CompletionPercent = p.CompletionPercent(),
                    ConnectionStatus  = conn?.Status.ToString() ?? "None",
                    ConnectionId      = conn?.Id,
                    IsSender          = conn?.SenderId == myUserId,
                };
            }).ToList();

            return Results.Ok(new { items, hasMore, nextCursor });
        }).RequireAuthorization();

        // Distinct countries for the country-filter panel in Find Friends
        group.MapGet("/countries", async (ProfilesDbContext db) =>
        {
            var list = await db.Profiles
                .Where(p => p.Country != null && p.Country != "")
                .Select(p => p.Country!)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();
            return Results.Ok(list);
        });

        return app;
    }

    private static string UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // ── Smart skill-match scoring ────────────────────────────────────────────

    private static (int score, List<string> reasons) ScoreProfile(
        CombinedStudies.Profiles.Entities.Profile candidate,
        string[] myWanted,
        string[] myTeaches)
    {
        int score = 0;
        var reasons = new List<string>();

        var theyTeach = candidate.SubjectsKnown.Concat(candidate.SubjectsCanTeach)
                           .Select(s => s.Trim()).ToArray();
        var theyWant  = candidate.SubjectsWanted.Select(s => s.Trim()).ToArray();

        var matchedTeachKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var matchedWantKeys  = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Rule 1 (+3 exact / +2 fuzzy): they can teach me something I want
        foreach (var skill in theyTeach)
        {
            var sl = skill.ToLower();
            if (matchedTeachKeys.Contains(sl)) continue;
            bool matched = false;
            foreach (var mw in myWanted)
            {
                if (sl == mw)
                {
                    score += 3; matchedTeachKeys.Add(sl);
                    reasons.Add($"Teaches {skill}"); matched = true; break;
                }
            }
            if (!matched)
            {
                foreach (var mw in myWanted)
                {
                    if (FuzzySkillMatch(sl, mw))
                    {
                        score += 2; matchedTeachKeys.Add(sl);
                        reasons.Add($"Teaches {skill}"); break;
                    }
                }
            }
        }

        // Rule 2 (+3 exact / +2 fuzzy): I can teach them something they want
        foreach (var skill in theyWant)
        {
            var sl = skill.ToLower();
            if (matchedWantKeys.Contains(sl)) continue;
            bool matched = false;
            foreach (var mt in myTeaches)
            {
                if (sl == mt)
                {
                    score += 3; matchedWantKeys.Add(sl);
                    reasons.Add($"Wants {skill}"); matched = true; break;
                }
            }
            if (!matched)
            {
                foreach (var mt in myTeaches)
                {
                    if (FuzzySkillMatch(sl, mt))
                    {
                        score += 2; matchedWantKeys.Add(sl);
                        reasons.Add($"Wants {skill}"); break;
                    }
                }
            }
        }

        // Rule 3 (+1): shared learning partner (both want the same skill)
        foreach (var skill in theyWant)
        {
            var sl = skill.ToLower();
            if (matchedTeachKeys.Contains(sl)) continue; // already counted above
            foreach (var mw in myWanted)
            {
                if (sl == mw) { score += 1; reasons.Add($"Also learning {skill}"); break; }
            }
        }

        return (score, reasons);
    }

    private static bool FuzzySkillMatch(string a, string b)
    {
        if (a == b) return false; // exact — handled by the == check before this
        if (a.Contains(b) || b.Contains(a)) return true; // substring
        int maxLen = Math.Max(a.Length, b.Length);
        if (maxLen < 3) return false;
        return (double)LevenshteinDistance(a, b) / maxLen <= 0.35;
    }

    // Search-time fuzzy match: handles typos like ansible→ansble, devops→davops
    // Threshold scales with search length so short queries stay strict
    private static bool FuzzySkillSearch(string skillValue, string search)
    {
        if (skillValue == search) return true;
        if (skillValue.Contains(search) || search.Contains(skillValue)) return true;
        if (search.Length <= 3) return false;
        int maxDist = search.Length <= 7 ? 1 : 2;
        return LevenshteinDistance(skillValue, search) <= maxDist;
    }

    private static int LevenshteinDistance(string s, string t)
    {
        int n = s.Length, m = t.Length;
        if (n == 0) return m;
        if (m == 0) return n;
        var dp = new int[n + 1, m + 1];
        for (int i = 0; i <= n; i++) dp[i, 0] = i;
        for (int j = 0; j <= m; j++) dp[0, j] = j;
        for (int i = 1; i <= n; i++)
            for (int j = 1; j <= m; j++)
                dp[i, j] = s[i - 1] == t[j - 1]
                    ? dp[i - 1, j - 1]
                    : 1 + Math.Min(dp[i - 1, j - 1], Math.Min(dp[i - 1, j], dp[i, j - 1]));
        return dp[n, m];
    }
}
