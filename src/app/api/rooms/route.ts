import type {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '../../../lib/http/api-response';
import {requireUser} from '../../../modules/auth/auth.service';
import {listRooms} from '../../../modules/rooms/room.service';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireUser(request);
    return apiSuccess(await listRooms({
      minCapacity: request.nextUrl.searchParams.get('minCapacity') ?? undefined,
    }));
  } catch (error) {
    return apiError(error);
  }
}
