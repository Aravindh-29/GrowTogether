FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CombinedStudies.sln", "."]
COPY ["src/CombinedStudies.Api/CombinedStudies.Api.csproj", "src/CombinedStudies.Api/"]
COPY ["src/CombinedStudies.Shared/CombinedStudies.Shared.csproj", "src/CombinedStudies.Shared/"]
COPY ["src/Modules/Identity/CombinedStudies.Identity.csproj", "src/Modules/Identity/"]
COPY ["src/Modules/Profiles/CombinedStudies.Profiles.csproj", "src/Modules/Profiles/"]
COPY ["src/Modules/Matching/CombinedStudies.Matching.csproj", "src/Modules/Matching/"]
COPY ["src/Modules/Connections/CombinedStudies.Connections.csproj", "src/Modules/Connections/"]
COPY ["src/Modules/Chat/CombinedStudies.Chat.csproj", "src/Modules/Chat/"]
COPY ["src/Modules/Classrooms/CombinedStudies.Classrooms.csproj", "src/Modules/Classrooms/"]
COPY ["src/Modules/Ideas/CombinedStudies.Ideas.csproj", "src/Modules/Ideas/"]
COPY ["src/Modules/Groups/CombinedStudies.Groups.csproj", "src/Modules/Groups/"]
COPY ["src/Modules/Reputation/CombinedStudies.Reputation.csproj", "src/Modules/Reputation/"]
RUN dotnet restore "src/CombinedStudies.Api/CombinedStudies.Api.csproj"
COPY . .
RUN dotnet publish "src/CombinedStudies.Api/CombinedStudies.Api.csproj" -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CombinedStudies.Api.dll"]
