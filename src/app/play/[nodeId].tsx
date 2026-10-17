import { useLocalSearchParams } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';

import { LevelRecovery } from '../../screens/LevelRecovery';
import { LevelScreen } from '../../screens/LevelScreen';

function useNodeId(): string {
  const { nodeId } = useLocalSearchParams<{ nodeId: string }>();
  const id = Array.isArray(nodeId) ? nodeId[0] : nodeId;
  return id ?? 'ch1-n1';
}

export default function PlayRoute() {
  const id = useNodeId();
  return <LevelScreen key={id} nodeId={id} />;
}

// Anything that throws while a stop renders lands here instead of taking the
// whole game down; the child gets a way back in.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const id = useNodeId();
  return <LevelRecovery nodeId={id} onRestarted={() => void retry()} />;
}
