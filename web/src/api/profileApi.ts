import api from './authApi';

export interface EducationDto {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  description?: string;
}

export interface ExperienceDto {
  company: string;
  title: string;
  employmentType?: string;
  location?: string;
  startYear: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  description?: string;
}

export interface ProjectDto {
  name: string;
  description?: string;
  url?: string;
  technologies: string[];
}

export interface UpdatePersonalRequest {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  alternatePhone?: string;
  alternateEmail?: string;
  profilePictureUrl?: string;
  city?: string;
  country?: string;
  username?: string;
}

export interface UpdateProfessionalRequest {
  headline?: string;
  about?: string;
  website?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  twitterUrl?: string;
  isOpenToWork: boolean;
}

export interface UpdateSkillsRequest {
  subjectsKnown: string[];
  subjectsWanted: string[];
  role?: string;
  subjectsCanTeach?: string[];
}

export interface AvailabilitySlot {
  dayOfWeek: number;  // 0=Sun 1=Mon … 6=Sat
  startTime: string;  // "09:00"
  endTime: string;    // "17:00"
}

export interface CreateProfileRequest {
  personal: UpdatePersonalRequest;
  professional: UpdateProfessionalRequest;
  skills: UpdateSkillsRequest;
  educations: EducationDto[];
  experiences: ExperienceDto[];
  projects: ProjectDto[];
}

export interface EducationResponse extends EducationDto { id: string; }
export interface ExperienceResponse extends ExperienceDto { id: string; }
export interface ProjectResponse extends ProjectDto { id: string; }

export interface ProfileResponse {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  alternatePhone?: string;
  alternateEmail?: string;
  profilePictureUrl?: string;
  city?: string;
  country?: string;
  username?: string;
  role?: string;
  headline?: string;
  about?: string;
  website?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  twitterUrl?: string;
  isOpenToWork: boolean;
  subjectsKnown: string[];
  subjectsWanted: string[];
  subjectsCanTeach: string[];
  educations: EducationResponse[];
  experiences: ExperienceResponse[];
  projects: ProjectResponse[];
  completionPercent: number;
  createdAt: string;
}

export interface ProfileSearchResult {
  id: string;
  userId: string;
  username?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  profilePictureUrl?: string;
  city?: string;
  country?: string;
  role?: string;
  headline?: string;
  isOpenToWork: boolean;
  subjectsKnown: string[];
  subjectsWanted: string[];
  completionPercent: number;
  // connection status enriched by search endpoint
  connectionStatus?: string;
  connectionId?: string;
  isSender?: boolean;
}

export interface PublicProfileResponse {
  id: string;
  userId: string;
  username?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  profilePictureUrl?: string;
  city?: string;
  country?: string;
  role?: string;
  headline?: string;
  about?: string;
  website?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  twitterUrl?: string;
  isOpenToWork: boolean;
  subjectsKnown: string[];
  subjectsWanted: string[];
  subjectsCanTeach?: string[];
  educations: EducationResponse[];
  experiences: ExperienceResponse[];
  projects: ProjectResponse[];
  completionPercent: number;
  connectionStatus: string;
  connectionId?: string;
  isSender: boolean;
}

export interface SuggestedProfile {
  id: string;
  userId: string;
  username?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  profilePictureUrl?: string;
  city?: string;
  country?: string;
  role?: string;
  headline?: string;
  isOpenToWork: boolean;
  subjectsKnown: string[];
  subjectsWanted: string[];
  completionPercent: number;
  matchScore: number;
  matchReasons: string[];
  connectionStatus: string;
  connectionId?: string;
  isSender: boolean;
}

export const profileApi = {
  getMe: () => api.get<ProfileResponse>('/profiles/me'),
  create: (req: CreateProfileRequest) => api.post<ProfileResponse>('/profiles', req),
  updatePersonal: (req: UpdatePersonalRequest) => api.patch<ProfileResponse>('/profiles/me/personal', req),
  updateProfessional: (req: UpdateProfessionalRequest) => api.patch<ProfileResponse>('/profiles/me/professional', req),
  updateSkills: (req: UpdateSkillsRequest) => api.patch<ProfileResponse>('/profiles/me/skills', req),
  updateEducations: (items: EducationDto[]) => api.patch<ProfileResponse>('/profiles/me/educations', { items }),
  updateExperiences: (items: ExperienceDto[]) => api.patch<ProfileResponse>('/profiles/me/experiences', { items }),
  updateProjects: (items: ProjectDto[]) => api.patch<ProfileResponse>('/profiles/me/projects', { items }),
  getProfile: (userId: string) => api.get<PublicProfileResponse>(`/profiles/${userId}`),
  getSuggested: (opts?: { page?: number; pageSize?: number; tab?: string; skill?: string }) => {
    const params = new URLSearchParams()
    if (opts?.page)     params.set('page',     String(opts.page))
    if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))
    if (opts?.tab)      params.set('tab',      opts.tab)
    if (opts?.skill)    params.set('skill',    opts.skill)
    return api.get<{ items: SuggestedProfile[]; total: number; page: number; pageSize: number }>(`/profiles/suggested?${params}`)
  },
  checkUsername: (username: string) => api.get<{ available: boolean; error?: string }>(`/profiles/check-username?username=${encodeURIComponent(username)}`),
  searchProfiles: (q?: string, role?: string, skill?: string, countries?: string[], cursor?: string, pageSize = 20) => {
    const params = new URLSearchParams()
    if (q)        params.set('q',        q)
    if (role)     params.set('role',     role)
    if (skill)    params.set('skill',    skill)
    if (countries?.length) countries.forEach(c => params.append('countries', c))
    if (cursor)   params.set('cursor',   cursor)
    if (pageSize) params.set('pageSize', String(pageSize))
    return api.get<{ items: ProfileSearchResult[]; hasMore: boolean; nextCursor: string | null }>(`/profiles/search?${params}`)
  },
  getCountries: () => api.get<string[]>('/profiles/countries'),
};
