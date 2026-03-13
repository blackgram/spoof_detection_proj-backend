import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ImagePickerProps {
  label: string;
  imageUri: string | null;
  onImageChange: (uri: string | null) => void;
  required?: boolean;
}

export default function ImagePickerComponent({
  label,
  imageUri,
  onImageChange,
  required = false,
}: ImagePickerProps) {
  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to select an ID photo.'
      );
      return false;
    }
    return true;
  };

  const handlePickImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled) {
      onImageChange(result.assets[0].uri);
    }
  };

  const handleRemove = () => {
    onImageChange(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.changeButton, pressed && styles.buttonPressed]}
              onPress={handlePickImage}
              android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.removeButton, pressed && styles.buttonPressed]}
              onPress={handleRemove}
              android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.uploadArea, pressed && styles.uploadAreaPressed]}
          onPress={handlePickImage}
          android_ripple={{ color: 'rgba(14,165,233,0.15)' }}
        >
          <View style={styles.uploadIconWrap}>
            <Text style={styles.uploadIcon}>📷</Text>
          </View>
          <Text style={styles.uploadText}>Tap to select ID photo</Text>
          <Text style={styles.uploadHint}>PNG, JPG • Crop to square</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  required: {
    color: '#ef4444',
  },
  previewContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    ...Platform.select({ android: { elevation: 2 } }),
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: '#e2e8f0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  changeButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#ffa646',
    borderRadius: 12,
  },
  changeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  removeButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  uploadAreaPressed: {
    backgroundColor: '#f1f5f9',
  },
  uploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadIcon: {
    fontSize: 32,
  },
  uploadText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  uploadHint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
  },
});
