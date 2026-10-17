import { chapterId, nodeId } from './ids';

test('content ids are branded and distinct', () => {
  const c = chapterId('ch1');
  const n = nodeId('ch1-n1');
  // @ts-expect-error a NodeId is not a ChapterId
  const wrong: typeof c = n;
  expect(wrong).toBe('ch1-n1');
  expect(c).toBe('ch1');
});
