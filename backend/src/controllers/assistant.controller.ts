import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { chatReply } from '../services/gemini.client';
import * as sessionSvc from '../services/assistant-chat-session.service';

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string().min(1).max(4000),
  })).min(1).max(30),
  sessionId: z.string().optional(),
  vehicleId: z.string().optional(),
});

export async function assistantReply(req: Request, res: Response, next: NextFunction) {
  try {
    const body = schema.parse(req.body);
    const reply = await chatReply(body.messages);
    let sessionId: string | undefined;
    if (req.user!.role === 'owner') {
      try {
        sessionId = await sessionSvc.saveAssistantTurn({
          userId: req.user!.userId,
          sessionId: body.sessionId,
          vehicleId: body.vehicleId,
          messages: body.messages,
          reply,
        });
      } catch (e) {
        console.warn('[assistant] session save failed:', e);
      }
    }
    res.json({ reply, sessionId });
  } catch (e) { next(e); }
}
