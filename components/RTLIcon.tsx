import React from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type MaterialIconsName = React.ComponentProps<typeof MaterialIcons>['name'];

interface IoniconProps {
  name: IoniconsName;
  size?: number;
  color?: string;
  flipOnRTL?: boolean;
}

/**
 * Ionicons wrapper that auto-flips directional icons in RTL mode.
 * Pass `flipOnRTL={false}` to opt out.
 *
 * Recognized directional names: chevron-back, chevron-forward, arrow-back,
 * arrow-forward, arrow-back-circle, arrow-forward-circle, return-down-back,
 * return-up-forward, caret-back, caret-forward.
 */
export function RTLIonicon({ name, flipOnRTL = true, ...rest }: IoniconProps) {
  const { language } = useApp();
  const isRTL = language === 'ar';

  const finalName: IoniconsName =
    flipOnRTL && isRTL ? (mirrorIonicon(name) as IoniconsName) : name;

  return <Ionicons name={finalName} {...rest} />;
}

interface MaterialProps {
  name: MaterialIconsName;
  size?: number;
  color?: string;
  flipOnRTL?: boolean;
}

export function RTLMaterialIcon({ name, flipOnRTL = true, ...rest }: MaterialProps) {
  const { language } = useApp();
  const isRTL = language === 'ar';

  const finalName: MaterialIconsName =
    flipOnRTL && isRTL ? (mirrorMaterial(name) as MaterialIconsName) : name;

  return <MaterialIcons name={finalName} {...rest} />;
}

const ionMirrors: Record<string, string> = {
  'chevron-back': 'chevron-forward',
  'chevron-forward': 'chevron-back',
  'chevron-back-outline': 'chevron-forward-outline',
  'chevron-forward-outline': 'chevron-back-outline',
  'chevron-back-circle': 'chevron-forward-circle',
  'chevron-forward-circle': 'chevron-back-circle',
  'arrow-back': 'arrow-forward',
  'arrow-forward': 'arrow-back',
  'arrow-back-outline': 'arrow-forward-outline',
  'arrow-forward-outline': 'arrow-back-outline',
  'arrow-back-circle': 'arrow-forward-circle',
  'arrow-forward-circle': 'arrow-back-circle',
  'caret-back': 'caret-forward',
  'caret-forward': 'caret-back',
  'caret-back-outline': 'caret-forward-outline',
  'caret-forward-outline': 'caret-back-outline',
  'return-down-back': 'return-down-forward',
  'return-down-forward': 'return-down-back',
};

const materialMirrors: Record<string, string> = {
  'chevron-left': 'chevron-right',
  'chevron-right': 'chevron-left',
  'arrow-back': 'arrow-forward',
  'arrow-forward': 'arrow-back',
  'arrow-back-ios': 'arrow-forward-ios',
  'arrow-forward-ios': 'arrow-back-ios',
  'keyboard-arrow-left': 'keyboard-arrow-right',
  'keyboard-arrow-right': 'keyboard-arrow-left',
  'navigate-before': 'navigate-next',
  'navigate-next': 'navigate-before',
};

function mirrorIonicon(name: string): string {
  return ionMirrors[name] ?? name;
}

function mirrorMaterial(name: string): string {
  return materialMirrors[name] ?? name;
}
