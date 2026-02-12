import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { VerificationResult } from '../api/verify';

interface ResultDisplayProps {
  result: VerificationResult | null;
  isLoading: boolean;
  error: string | null;
}

export default function ResultDisplay({ result, isLoading, error }: ResultDisplayProps) {
  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Verifying identity...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!result) {
    return null;
  }

  const isPass = result.overall_result === 'pass';
  const isSpoof = result.overall_result === 'spoof_detected';

  return (
    <View style={styles.card}>
      {/* Overall Result */}
      <View
        style={[
          styles.resultBanner,
          isPass ? styles.passBanner : isSpoof ? styles.spoofBanner : styles.failBanner,
        ]}
      >
        <Text style={styles.resultIcon}>{isPass ? '✓' : '✗'}</Text>
        <View style={styles.resultContent}>
          <Text
            style={[
              styles.resultTitle,
              isPass ? styles.passText : styles.failText,
            ]}
          >
            {isPass ? 'Verification Passed' : isSpoof ? 'Spoof Detected' : 'Verification Failed'}
          </Text>
          <Text style={styles.resultMessage}>{result.message}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailBlock}>
          <Text style={styles.detailTitle}>LIVENESS CHECK</Text>
          <Text
            style={[
              styles.detailValue,
              result.liveness_check.is_real ? styles.passText : styles.failText,
            ]}
          >
            {result.liveness_check.is_real ? 'Real' : 'Spoof Detected'}
          </Text>
          <Text style={styles.confidenceText}>
            {(result.liveness_check.confidence * 100).toFixed(1)}% confidence
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                result.liveness_check.is_real ? styles.passFill : styles.failFill,
                { width: `${result.liveness_check.confidence * 100}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.detailBlock}>
          <Text style={styles.detailTitle}>FACE VERIFICATION</Text>
          <Text
            style={[
              styles.detailValue,
              result.face_verification.verified ? styles.passText : styles.failText,
            ]}
          >
            {result.face_verification.verified ? 'Matched' : 'Not Matched'}
          </Text>
          <Text style={styles.confidenceText}>
            {(result.face_verification.confidence * 100).toFixed(1)}% confidence
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                result.face_verification.verified ? styles.passFill : styles.failFill,
                { width: `${result.face_verification.confidence * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  passBanner: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  spoofBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  failBanner: {
    backgroundColor: '#fef9c3',
    borderWidth: 1,
    borderColor: '#fde047',
  },
  resultIcon: {
    fontSize: 32,
    marginRight: 12,
    color: '#16a34a',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  passText: {
    color: '#15803d',
  },
  failText: {
    color: '#b91c1c',
  },
  resultMessage: {
    fontSize: 14,
    color: '#374151',
  },
  detailsGrid: {
    width: '100%',
    gap: 16,
  },
  detailBlock: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  passFill: {
    backgroundColor: '#22c55e',
  },
  failFill: {
    backgroundColor: '#ef4444',
  },
});
