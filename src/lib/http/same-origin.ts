import {readAppEnv} from '../config/env';
import {DomainError} from './domain-error';

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin ?? '').origin;
  } catch {
    requestOrigin = '';
  }
  const appOrigin = new URL(readAppEnv().appUrl).origin;

  if (!requestOrigin || requestOrigin !== appOrigin) {
    throw new DomainError({
      code: 'FORBIDDEN_ORIGIN',
      message: 'Request origin is not allowed',
      status: 403,
    });
  }
}
