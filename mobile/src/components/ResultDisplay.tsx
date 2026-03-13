import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import type { VerificationResult } from '../api/verify';
import { colors, radius, spacing } from '../theme';

interface ResultDisplayProps {
  result: VerificationResult | null;
  isLoading: boolean;
  error: string | null;
}

export default function ResultDisplay({ result, isLoading, error }: ResultDisplayProps) {
  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Verifying identity...</Text>
        <Text style={styles.loadingSubtext}>Liveness & face match in progress</Text>
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

  const resultIcon = isPass ? '✓' : isSpoof ? '⚠' : '✗';

  return (
    <View style={styles.card}>
      {/* Overall Result */}
      <View
        style={[
          styles.resultBanner,
          isPass ? styles.passBanner : isSpoof ? styles.spoofBanner : styles.failBanner,
        ]}
      >
        <View
          style={[
            styles.resultIconWrap,
            isPass ? styles.passIconWrap : isSpoof ? styles.spoofIconWrap : styles.failIconWrap,
          ]}
        >
          <Text style={styles.resultIcon}>{resultIcon}</Text>
        </View>
        <View style={styles.resultContent}>
          <Text
            style={[
              styles.resultTitle,
              isPass ? styles.passText : isSpoof ? styles.spoofText : styles.failText,
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
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    ...Platform.select({ android: { elevation: 2 } }),
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 17,
    color: colors.text,
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorCard: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorMuted,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.error,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    width: '100%',
  },
  passBanner: {
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  spoofBanner: {
    backgroundColor: colors.errorMuted,
    borderWidth: 1,
    borderColor: colors.error,
  },
  failBanner: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  resultIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  passIconWrap: {
    backgroundColor: colors.success,
  },
  spoofIconWrap: {
    backgroundColor: colors.error,
  },
  failIconWrap: {
    backgroundColor: colors.warning,
  },
  resultIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  passText: {
    color: colors.success,
  },
  spoofText: {
    color: colors.error,
  },
  failText: {
    color: colors.warning,
  },
  resultMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  detailsGrid: {
    width: '100%',
    gap: spacing.md,
  },
  detailBlock: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    letterSpacing: 0.8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.cardBorder,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  passFill: {
    backgroundColor: colors.success,
  },
  failFill: {
    backgroundColor: colors.error,
  },
});
