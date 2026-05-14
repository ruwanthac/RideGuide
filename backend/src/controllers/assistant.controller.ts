import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { chatReply } from '../services/gemini.client';
import * as sessionSvc from '../services/assistant-chat-session.service';

const assistantMessageSchema = z
  .object({
    role: z.enum(['user', 'model']),
    content: z.string().max(4000).default(''),
    imageBase64: z.string().max(1_500_000).optional(),
    imageMimeType: z.string().max(120).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.role === 'model' && (m.imageBase64 || m.imageMimeType)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'model messages cannot include images' });
    }
    if (m.role === 'model' && !m.content.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'model content required' });
    }
    if (m.role === 'user') {
      const hasText = m.content.trim().length > 0;
      const hasImg = !!(m.imageBase64 && m.imageMimeType);
      if (!hasText && !hasImg) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'user message needs text and/or image' });
      }
      if (m.imageBase64 && !m.imageMimeType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'imageMimeType required with imageBase64' });
      }
      if (m.imageMimeType && !m.imageBase64) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'imageBase64 required with imageMimeType' });
      }
    }
  });

const schema = z.object({
  messages: z.array(assistantMessageSchema).min(1).max(30),
  sessionId: z.string().optional(),
  vehicleId: z.string().optional(),
});

function messagesForPersistence(
  messages: z.infer<typeof assistantMessageSchema>[],
): { role: 'user' | 'model'; content: string }[] {
  return messages.map((m) => {
    if (m.role === 'model') {
      return { role: 'model', content: m.content.trim() };
    }
    const t = m.content.trim();
    if (m.imageBase64 && m.imageMimeType) {
      const label = t ? `${t}\n[Photo attached]` : '[Photo attached]';
      return { role: 'user', content: label.slice(0, 8000) };
    }
    return { role: 'user', content: t.slice(0, 8000) };
  });
}

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
          messages: messagesForPersistence(body.messages),
          reply,
        });
      } catch (e) {
        console.warn('[assistant] session save failed:', e);
      }
    }
    res.json({ reply, sessionId });
  } catch (e) { next(e); }
}
