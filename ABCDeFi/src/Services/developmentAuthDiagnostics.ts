import { api } from './axiosConfig';

export interface DevelopmentAuthDiagnostics {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  accountStatus: 'active' | 'suspended' | 'unverified';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  otpExists: boolean;
  otpExpiresAt: string | null;
  otpRemainingSeconds: number;
  lastOtpGeneratedAt: string | null;
  lastOtpDeliveryMethod: string | null;
  resendCount: number;
  // Returned only by the development-only, persisted-admin-protected route.
  developmentOtp: string | null;
}

function responseMessage(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string };
  return candidate.response?.data?.message || candidate.message || 'Unable to load authentication diagnostics.';
}

export async function getDevelopmentAuthDiagnostics(userId: string): Promise<DevelopmentAuthDiagnostics> {
  try {
    const response = await api.get<{ success: boolean; data: DevelopmentAuthDiagnostics }>(
      `user/admin/auth-debug/${encodeURIComponent(userId)}`,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(responseMessage(error));
  }
}

export async function resendDevelopmentLoginOtp(userId: string): Promise<string> {
  try {
    const response = await api.post<{ success: boolean; message?: string }>('user/resend-login-otp', { userId });
    return response.data.message || 'A new login OTP was requested.';
  } catch (error) {
    throw new Error(responseMessage(error));
  }
}
