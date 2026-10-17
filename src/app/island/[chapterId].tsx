import { useLocalSearchParams } from 'expo-router';

import { IslandDoneScreen } from '../../screens/IslandDoneScreen';

export default function IslandRoute() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const id = Array.isArray(chapterId) ? chapterId[0] : chapterId;
  return <IslandDoneScreen key={id} chapterId={id ?? ''} />;
}
