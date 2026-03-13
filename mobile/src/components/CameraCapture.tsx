import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface CameraCaptureProps {
  imageUri: string | null;
  onImageCapture: (uri: string | null) => void;
  required?: boolean;
  /** Optional label (default: "Selfie Image (Camera)") */
  label?: string;
}

export default function CameraCapture({
  imageUri,
  onImageCapture,
  required = false,
  label = 'Selfie Image (Camera)',
}: CameraCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (isCapturing && !permission?.granted) {
      requestPermission();
    }
  }, [isCapturing, permission]);

  const handleStartCapture = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Camera permission required',
          'Please allow camera access to capture your selfie.'
        );
        return;
      }
    }
    setIsCapturing(true);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });

      if (photo?.uri) {
        onImageCapture(photo.uri);
        setIsCapturing(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      console.error('Camera capture error:', error);
    }
  };

  const handleCancel = () => {
    setIsCapturing(false);
  };

  const handleRemove = () => {
    onImageCapture(null);
  };

  const handleRetake = () => {
    onImageCapture(null);
    setIsCapturing(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      {imageUri && !isCapturing ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.retakeButton, pressed && styles.buttonPressed]}
              onPress={handleRetake}
              android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <Text style={styles.retakeButtonText}>Retake</Text>
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
      ) : isCapturing ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} facing="front" />
          {/* Face oval guide for liveness */}
          <View style={styles.faceOvalOverlay} pointerEvents="none">
            <View style={styles.faceOval} />
            <Text style={styles.faceOvalHint}>Position your face in the oval</Text>
          </View>
          <View style={styles.cameraOverlay}>
            <Pressable
              style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
              onPress={handleCapture}
              android_ripple={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <View style={styles.captureButtonInner} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
              onPress={handleCancel}
              android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.uploadArea, pressed && styles.uploadAreaPressed]}
          onPress={handleStartCapture}
          android_ripple={{ color: 'rgba(14,165,233,0.15)' }}
        >
          <View style={styles.uploadIconWrap}>
            <Text style={styles.uploadIcon}>📸</Text>
          </View>
          <Text style={styles.uploadText}>Tap to capture selfie</Text>
          <Text style={styles.uploadHint}>Live photo required for liveness check</Text>
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
  retakeButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#ffa646',
    borderRadius: 12,
  },
  retakeButtonText: {
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
  cameraContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Platform.select({ android: { elevation: 4 } }),
  },
  camera: {
    flex: 1,
    minHeight: 340,
  },
  faceOvalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOval: {
    width: 220,
    height: 280,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  faceOvalHint: {
    position: 'absolute',
    bottom: 100,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 28 : 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 5,
    borderColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0ea5e9',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
  },
  cancelButtonText: {
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
