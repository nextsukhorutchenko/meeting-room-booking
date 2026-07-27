import type {NextRequest} from 'next/server';
import {apiError} from '../../../../lib/http/api-response';
import {assertSameOrigin} from '../../../../lib/http/same-origin';
import {requireUser} from '../../../../modules/auth/auth.service';
import {cancelBooking} from '../../../../modules/bookings/booking.service';

type CancellationContext = {
  params: Promise<{bookingId: string}>;
};

export async function DELETE(
  request: NextRequest,
  {params}: CancellationContext,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.clone());
    const {bookingId} = await params;
    await cancelBooking({
      bookingId,
      userId: user.id,
      cancelledAt: new Date(),
    });
    return new Response(null, {status: 204});
  } catch (error) {
    return apiError(error);
  }
}
