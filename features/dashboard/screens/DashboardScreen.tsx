import {ErrorBoundary} from '../../../components/ErrorBoundary';
import DisplayEditorScreen from './DisplayEditorScreen';

export default function DashboardScreen() {
  return (
    <ErrorBoundary label="dashboard-editor">
      <DisplayEditorScreen />
    </ErrorBoundary>
  );
}
