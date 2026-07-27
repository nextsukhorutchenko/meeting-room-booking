import type {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '../../../../../lib/http/api-response';
import {requireUser} from '../../../../../modules/auth/auth.service';
import {getWeeklySchedule} from '../../../../../modules/rooms/room.service';

type RouteContext = {params: Promise<{roomId: string}>};

export async function GET(
  request: NextRequest,
  {params}: RouteContext,
): Promise<Response> {
  try {
    const user = await requireUser(request);
    const {roomId} = await params;
    const response = apiSuccess(await getWeeklySchedule({
      roomId,
      userId: user.id,
      weekStart: request.nextUrl.searchParams.get('weekStart') ?? '',
    }));
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return apiError(error);
  }
}
