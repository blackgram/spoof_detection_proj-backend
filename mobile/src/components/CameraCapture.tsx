import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface CameraCaptureProps {
  imageUri: string | null;
  onImageCapture: (uri: string | null) => void;
  required?: boolean;
}

export default function CameraCapture({
  imageUri,
  onImageCapture,
  required = false,
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
        Selfie Image (Camera)
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      {imageUri && !isCapturing ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isCapturing ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} facing="front" />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <Text style={styles.captureButtonText}>Capture</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadArea} onPress={handleStartCapture}>
          <Text style={styles.uploadIcon}>📸</Text>
          <Text style={styles.uploadText}>Tap to capture selfie</Text>
          <Text style={styles.uploadHint}>Take a live photo for verification</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  previewContainer: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  retakeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  retakeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  removeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cameraContainer: {
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    minHeight: 300,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  captureButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    alignItems: 'center',
  },
  captureButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  uploadHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});
