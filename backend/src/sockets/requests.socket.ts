import { getIo } from './index';

export function emitRequestNew(doc: any) {
  const room = doc.type === 'roadside' ? 'providers:mechanic' : 'providers:tow';
  getIo().to(room).emit('request:new', doc);
}

export function emitRequestUpdated(doc: any) {
  getIo().to(`request:${doc._id}`).emit('request:updated', doc);
  const room = doc.type === 'roadside' ? 'providers:mechanic' : 'providers:tow';
  getIo().to(room).emit('request:updated', doc);
  if (doc.requesterId) getIo().to(`user:${String(doc.requesterId)}`).emit('request:updated', doc);
}

export function emitRequestRemoved(payload: { id: string; type: 'roadside' | 'tow'; requesterId: string }) {
  const { id, type, requesterId } = payload;
  const body = { _id: id, id, removed: true, type };
  getIo().to(`request:${id}`).emit('request:removed', body);
  const room = type === 'roadside' ? 'providers:mechanic' : 'providers:tow';
  getIo().to(room).emit('request:removed', body);
  getIo().to(`user:${requesterId}`).emit('request:removed', body);
}
