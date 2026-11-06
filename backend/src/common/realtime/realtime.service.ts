import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface RealtimeEvent {
  type:
    | 'EXPENSE_CREATED'
    | 'EXPENSE_UPDATED'
    | 'SETTLEMENT_UPDATED'
    | 'TASK_UPDATED'
    | 'GOAL_UPDATED'
    | 'SHOPPING_UPDATED'
    | 'CALENDAR_UPDATED'
    | 'EVENT_CREATED'
    | 'NOTIFICATION_CREATED'
    | 'WORKOUT_UPDATED'
    | 'REFETCH';
  householdId?: string | null;
  userId?: string | null;
  data?: any;
  timestamp: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly events$ = new Subject<RealtimeEvent>();

  emit(event: Omit<RealtimeEvent, 'timestamp'>) {
    const fullEvent: RealtimeEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(
      `[Realtime] Emitting ${fullEvent.type} (user: ${fullEvent.userId || 'any'}, household: ${fullEvent.householdId || 'any'})`,
    );
    this.events$.next(fullEvent);
  }

  getEvents(userId: string, householdId?: string | null): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter((event) => {
        // Se o evento tem householdId e o usuário pertence a essa casa, entrega
        if (event.householdId && householdId && event.householdId === householdId) {
          return true;
        }
        // Se o evento é direcionado especificamente a esse usuário
        if (event.userId && event.userId === userId) {
          return true;
        }
        // Se o evento for broadcast geral
        if (!event.householdId && !event.userId) {
          return true;
        }
        return false;
      }),
      map((event) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }
}
