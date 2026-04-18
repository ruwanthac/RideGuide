import { getIo } from './index';

export function emitRequestNew(doc: any) {
  const room = doc.type === 'roadside' ? 'providers:mechanic' : 'providers:tow';
  getIo().to(room).emit('request:new', doc);
}

export function emitRequestUpdated(doc: any) {
  getIo().to(`request:${doc._id}`).emit('request:updated', doc);
  const room = doc.type === 'roadside' ? 'providers:mechanic' : 'providers:tow';
  getIo().to(room).emit('request:updated', doc);
}
