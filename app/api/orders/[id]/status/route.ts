import { requireAuth, unauthorized } from '@/lib/auth';
import { HttpError, transitionStatus } from '@/lib/services/orderWorkflow';

// Mirrors backend/app/routers/orders.py's update_order_status. All the logic (including the
// once-only production/FIFO consumption) lives in orderWorkflow.transitionStatus.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const { status } = (await request.json()) as { status: string };

  try {
    const { order, shortfall } = await transitionStatus(id, status);
    return Response.json({ order, shortfall });
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ detail: err.message }, { status: err.status });
    throw err;
  }
}
