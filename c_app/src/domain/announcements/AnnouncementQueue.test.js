import { AnnouncementQueue } from './AnnouncementQueue';

describe('AnnouncementQueue scopes', () => {
  it('removes stale scoped items without clearing unrelated announcements', () => {
    const queue = new AnnouncementQueue();
    queue.enqueue('Old detection', 'normal', 'detection:old', 'camera-detection');
    queue.enqueue('Status update', 'high', 'status');

    queue.clearScope('camera-detection');

    expect(queue.snapshot().map(item => item.text)).toEqual(['Status update']);
  });
});
