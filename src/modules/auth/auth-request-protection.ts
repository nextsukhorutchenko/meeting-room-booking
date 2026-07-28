import {readAppEnv} from '../../lib/config/env';
import {readJsonBody} from '../../lib/http/api-response';
import {
  type AuthRateLimitAction,
  enforceAuthRateLimit,
  readClientIp,
  readRateLimitIdentity,
} from './auth-rate-limit.service';

export async function readProtectedAuthBody(
  request: Request,
  action: AuthRateLimitAction,
): Promise<unknown> {
  const env = readAppEnv();
  const body = await readJsonBody(request, env.authRequestBodyMaxBytes);
  await enforceAuthRateLimit({
    action,
    clientIp: readClientIp(request, env.authClientIpHeader),
    identity: readRateLimitIdentity(body),
    now: new Date(),
    policy: {
      identityLimit: action === 'login' ?
        env.authLoginIdentityLimit :
        env.authRegisterIdentityLimit,
      ipLimit: action === 'login' ?
        env.authLoginIpLimit :
        env.authRegisterIpLimit,
      windowSeconds: env.authRateLimitWindowSeconds,
    },
  });
  return body;
}
