import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import ImagePickerComponent from './src/components/ImagePicker';
import CameraCapture from './src/components/CameraCapture';
import ResultDisplay from './src/components/ResultDisplay';
import { verifyIdentity, warmup } from './src/api/verify';
import type { VerificationResult } from './src/api/verify';

export default function App() {
  useEffect(() => {
    warmup(); // Pre-load models so verify is fast
  }, []);
  const [idImageUri, setIdImageUri] = useState<string | null>(null);
  const [selfieImageUri, setSelfieImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!idImageUri || !selfieImageUri) {
      setError('Please provide both ID photo and selfie');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await verifyIdentity(idImageUri, selfieImageUri);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      console.error('Verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIdImageUri(null);
    setSelfieImageUri(null);
    setResult(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Face Verification</Text>
            <Text style={styles.subtitle}>Verify identity with ID photo & selfie</Text>
          </View>

          {/* Upload Section */}
          <View style={styles.card}>
            <ImagePickerComponent
              label="ID Photo / Reference Image"
              imageUri={idImageUri}
              onImageChange={setIdImageUri}
              required
            />

            <CameraCapture
              imageUri={selfieImageUri}
              onImageCapture={setSelfieImageUri}
              required
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  (isLoading || !idImageUri || !selfieImageUri) && styles.verifyButtonDisabled,
                ]}
                onPress={handleVerify}
                disabled={isLoading || !idImageUri || !selfieImageUri}
              >
                <Text style={styles.verifyButtonText}>
                  {isLoading ? 'Verifying...' : 'Verify Identity'}
                </Text>
              </TouchableOpacity>

              {(result || error) && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                  disabled={isLoading}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Results */}
          {(result || isLoading || error) && (
            <ResultDisplay result={result} isLoading={isLoading} error={error} />
          )}

          {/* Info */}
          {!result && !isLoading && !error && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoText}>• Select your ID photo from gallery</Text>
              <Text style={styles.infoText}>• Capture a selfie with camera</Text>
              <Text style={styles.infoText}>• Tap Verify to check liveness & face match</Text>
              <Text style={styles.infoHint}>
                Make sure the backend is running at the configured API URL.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  container: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  verifyButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
  },
  infoHint: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
