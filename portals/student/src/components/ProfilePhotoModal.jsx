import CanonicalProfilePhotoModal from '../../../../shared/src/components/ProfilePhotoModal.jsx';
import { useTheme } from '../ThemeContext';

export default function ProfilePhotoModal(props) {
  return <CanonicalProfilePhotoModal {...props} useTheme={useTheme} />;
}
