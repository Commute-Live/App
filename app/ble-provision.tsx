import {ErrorBoundary} from '../components/ErrorBoundary';
import BleProvisionScreen from '../features/device/screens/BleProvisionScreen';

export default function BleProvisionRoute() {
  return (
    <ErrorBoundary label="ble-provision">
      <BleProvisionScreen />
    </ErrorBoundary>
  );
}
