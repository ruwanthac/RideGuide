import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { chatReply } from '../services/gemini.client';

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string().min(1).max(4000),
  })).min(1).max(30),
});

export async function assistantReply(req: Request, res: Response, next: NextFunction) {
  try {
    const body = schema.parse(req.body);
    const reply = await chatReply(body.messages);
    res.json({ reply });
  } catch (e) { next(e); }
}
