import {
  Image,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

type FlagImageProps = {
  code: string;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
};

/** Bundled square-crop sources (w160 from same family as previous CDN) — works fully offline. */
const FLAG_SOURCES: Record<string, ImageSourcePropType> = {
  ng: require('@/assets/flags/ng.png'),
  gh: require('@/assets/flags/gh.png'),
  ke: require('@/assets/flags/ke.png'),
  za: require('@/assets/flags/za.png'),
  us: require('@/assets/flags/us.png'),
  gb: require('@/assets/flags/gb.png'),
  fr: require('@/assets/flags/fr.png'),
  pt: require('@/assets/flags/pt.png'),
  es: require('@/assets/flags/es.png'),
  sa: require('@/assets/flags/sa.png'),
};

export function FlagImage({ code, width = 24, height = 16, style }: FlagImageProps) {
  const lower = code.toLowerCase();
  const source = FLAG_SOURCES[lower];

  if (!source) {
    if (__DEV__) {
      console.warn(`[FlagImage] No bundled asset for code "${code}"`);
    }
    return (
      <View
        style={[{ width, height, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.08)' }, style]}
      />
    );
  }

  return (
    <Image
      source={source}
      style={[{ width, height, borderRadius: 2 }, style]}
      resizeMode="cover"
    />
  );
}
