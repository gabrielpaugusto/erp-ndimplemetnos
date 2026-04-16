export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserProfileDto;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: UserPermissionDto[];
}

export interface UserPermissionDto {
  module: string;
  actions: string[];
}
