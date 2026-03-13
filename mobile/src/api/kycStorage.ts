import * as SecureStore from 'expo-secure-store';
import {
  documentDirectory,
  getInfoAsync,
  copyAsync,
} from 'expo-file-system/legacy';

const KYC_REFERENCE_PATH_KEY = 'accessmore_kyc_reference_path';
const KYC_REFERENCE_FILENAME = 'kyc_reference.jpg';

export async function getKYCReferenceUri(): Promise<string | null> {
  const path = await SecureStore.getItemAsync(KYC_REFERENCE_PATH_KEY);
  if (!path) return null;
  try {
    const info = await getInfoAsync(path);
    return info.exists ? path : null;
  } catch {
    return null;
  }
}

export async function saveKYCReferenceFromUri(uri: string): Promise<void> {
  const dir = documentDirectory;
  if (!dir) throw new Error('No document directory');
  const dest = `${dir}${KYC_REFERENCE_FILENAME}`;
  await copyAsync({ from: uri, to: dest });
  await SecureStore.setItemAsync(KYC_REFERENCE_PATH_KEY, dest);
}
