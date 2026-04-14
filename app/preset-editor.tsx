import {ErrorBoundary} from '../components/ErrorBoundary';
import DisplayEditorScreen from '../features/dashboard/screens/DisplayEditorScreen';

export default function PresetEditorRoute() {
  return (
    <ErrorBoundary label="display-editor">
      <DisplayEditorScreen />
    </ErrorBoundary>
  );
}
