import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { HttpError } from "../lib/http-error";

/**
 * GoogleAuthService manages Google OAuth token lifecycle including automatic refresh.
 * Supports both per-user tokens (from OAuth login) and service-level tokens (from environment).
 */
export class GoogleAuthService {
  private env: Env;
  private store: MemoryStore;

  constructor(env: Env, store: MemoryStore) {
    this.env = env;
    this.store = store;
  }

  /**
   * Get a valid Google access token for the given user.
   * If the current token is expired or missing, automatically refreshes using the refresh token.
   * Falls back to service-level token if user has no tokens.
   */
  async getAccessToken(userId?: string): Promise<string> {
    // If user context provided, try to get user-specific token
    if (userId) {
      const user = this.store.findUserById(userId);
      if (user?.googleAccessToken) {
        // Check if token is still valid (with 5-minute buffer)
        if (
          user.googleAccessTokenExpiresAt &&
          this.isTokenExpired(user.googleAccessTokenExpiresAt, 300)
        ) {
          // Token expired, try to refresh
          if (user.googleRefreshToken) {
            try {
              const refreshed = await this.refreshAccessToken(user.googleRefreshToken);
              // Update user record with new token
              this.store.updateUserGoogleTokens(userId, {
                accessToken: refreshed.accessToken,
                expiresIn: refreshed.expiresIn
              });
              return refreshed.accessToken;
            } catch (error) {
              console.error(`Failed to refresh token for user ${userId}:`, error);
              // Fall through to service-level token
            }
          }
        } else {
          // Token still valid
          return user.googleAccessToken;
        }
      }

      if (user?.googleRefreshToken) {
        try {
          const refreshed = await this.refreshAccessToken(user.googleRefreshToken);
          this.store.updateUserGoogleTokens(userId, {
            accessToken: refreshed.accessToken,
            expiresIn: refreshed.expiresIn
          });
          return refreshed.accessToken;
        } catch (error) {
          console.error(`Failed to refresh token for user ${userId}:`, error);
          // Fall through to service-level token
        }
      }

      // No valid user token, fall through to service-level
    }

    // Use service-level token
    return this.getAccessTokenFromEnv();
  }

  /**
   * Get the service-level access token from environment.
   * Uses GOOGLE_REFRESH_TOKEN to obtain a fresh token if available.
   */
  async getAccessTokenFromEnv(): Promise<string> {
    if (!this.env.googleRefreshToken) {
      throw new HttpError(
        503,
        "Google API token not configured. Set GOOGLE_REFRESH_TOKEN in environment or authenticate with Google.",
        "GOOGLE_TOKEN_NOT_CONFIGURED"
      );
    }

    try {
      const refreshed = await this.refreshAccessToken(this.env.googleRefreshToken);
      return refreshed.accessToken;
    } catch (error) {
      throw new HttpError(
        502,
        "Failed to refresh service-level Google token",
        "GOOGLE_TOKEN_REFRESH_FAILED"
      );
    }
  }

  /**
   * Refresh an access token using a refresh token.
   * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
   */
  private async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    if (!this.env.googleClientId || !this.env.googleClientSecret) {
      throw new HttpError(
        501,
        "Google OAuth not configured (missing CLIENT_ID or CLIENT_SECRET)",
        "GOOGLE_OAUTH_NOT_CONFIGURED"
      );
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.env.googleClientId,
        client_secret: this.env.googleClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      throw new HttpError(
        502,
        "Google token refresh failed",
        "GOOGLE_TOKEN_REFRESH_FAILED"
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      throw new HttpError(
        502,
        "Google did not return an access token",
        "GOOGLE_TOKEN_REFRESH_FAILED"
      );
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600 // Default to 1 hour
    };
  }

  /**
   * Check if a token expiration time is in the past or within the specified buffer.
   * Buffer in seconds; defaults to 0 (check if already expired).
   */
  private isTokenExpired(expiresAt: string, bufferSeconds: number = 0): boolean {
    try {
      const expirationTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const bufferMs = bufferSeconds * 1000;
      return now + bufferMs >= expirationTime;
    } catch {
      // If we can't parse the expiration time, assume it's expired
      return true;
    }
  }
}
