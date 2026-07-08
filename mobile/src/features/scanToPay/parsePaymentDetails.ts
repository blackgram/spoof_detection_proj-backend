import { BANKS, type Bank } from '../../constants/banks';

export type ParseConfidence = 'high' | 'low';

export interface ParsedPaymentDetails {
  accountNumber: string | null;
  bank: Bank | null;
  detectedBankName: string | null;
  confidence: ParseConfidence;
  rawText: string;
}

export interface ParsedAccountEntry {
  accountNumber: string;
  bank: Bank | null;
  detectedBankName: string | null;
}

export interface ParsedPaymentDetailsMulti {
  entries: ParsedAccountEntry[];
  confidence: ParseConfidence;
  rawText: string;
}

const BANK_ALIASES: Record<string, string> = {
  gtb: '2',
  gtbank: '2',
  'guaranty trust': '2',
  'guaranty trust bank': '2',
  access: '1',
  'access bank plc': '1',
  zenith: '3',
  'zenith bank plc': '3',
  'first bank': '4',
  'first bank of nigeria': '4',
  fbnb: '4',
  uba: '5',
  'united bank for africa': '5',
  kuda: '6',
  'kuda mfb': '6',
  moniepoint: '7',
  'moniepoint mfb': '7',
  opay: '8',
  palmpay: '9',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isTenDigitAccount(digits: string): boolean {
  return digits.length === 10 && /^\d{10}$/.test(digits);
}

function cleanAccountCandidate(line: string): string | null {
  const withoutCopy = line.replace(/\bcopy\b/gi, '').trim();
  const digits = digitsOnly(withoutCopy);
  return isTenDigitAccount(digits) ? digits : null;
}

/** Value on same line after "Account Number" label, or on the next line. */
function extractAccountFromLabels(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const labelMatch = line.match(/^account\s*number\s*:?\s*(.*)$/i);
    if (!labelMatch) continue;

    const inline = labelMatch[1]?.trim();
    if (inline) {
      const fromInline = cleanAccountCandidate(inline);
      if (fromInline) return fromInline;
    }

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (/^(bank|bank account name)/i.test(next)) continue;
      const fromNext = cleanAccountCandidate(next);
      if (fromNext) return fromNext;
    }
  }
  return null;
}

/** Spaced digit groups e.g. "6680 5795 54" */
function extractAccountFallback(rawText: string): string | null {
  const spacedPattern = /\d(?:[\d\s]{8,14}\d)/g;
  let match: RegExpExecArray | null;
  while ((match = spacedPattern.exec(rawText)) !== null) {
    const candidate = cleanAccountCandidate(match[0]);
    if (candidate) return candidate;
  }

  const contiguous = rawText.match(/\b\d{10}\b/g);
  return contiguous?.[0] ?? null;
}

/** Line exactly "Bank" (not "Bank Account Name") → next line is bank name. */
function extractBankNameFromLabels(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^bank$/i.test(line)) continue;

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (/^bank account name$/i.test(next)) continue;
      if (/^account\s*number$/i.test(next)) continue;
      if (/^copy$/i.test(next)) continue;
      if (next.length >= 3) return next;
    }
  }
  return null;
}

function bankById(id: string): Bank | null {
  return BANKS.find((b) => b.id === id) ?? null;
}

function matchBankInText(text: string): { bank: Bank | null; confidence: ParseConfidence } {
  const normalized = normalize(text);
  if (!normalized) return { bank: null, confidence: 'low' };

  const sortedBanks = [...BANKS].sort((a, b) => b.name.length - a.name.length);

  for (const bank of sortedBanks) {
    const bankNorm = normalize(bank.name);
    if (normalized.includes(bankNorm)) {
      return { bank, confidence: 'high' };
    }
  }

  for (const [alias, bankId] of Object.entries(BANK_ALIASES)) {
    if (normalized.includes(alias)) {
      const bank = bankById(bankId);
      if (bank) return { bank, confidence: 'high' };
    }
  }

  return { bank: null, confidence: 'low' };
}

function findBank(
  rawText: string,
  detectedBankName: string | null,
): { bank: Bank | null; bankConfidence: ParseConfidence } {
  if (detectedBankName) {
    const fromLabel = matchBankInText(detectedBankName);
    if (fromLabel.bank) return fromLabel;
  }

  const fromFull = matchBankInText(rawText);
  if (fromFull.bank) return fromFull;

  return { bank: null, confidence: 'low' };
}

export function parsePaymentDetails(rawText: string): ParsedPaymentDetails {
  const lines = splitLines(rawText);
  const detectedBankName = extractBankNameFromLabels(lines);

  const accountNumber =
    extractAccountFromLabels(lines) ?? extractAccountFallback(rawText);

  const { bank, bankConfidence } = findBank(rawText, detectedBankName);

  let confidence: ParseConfidence = 'low';
  if (accountNumber && bank && bankConfidence === 'high') {
    confidence = 'high';
  } else if (accountNumber && bank) {
    confidence = 'low';
  } else if (accountNumber && detectedBankName) {
    confidence = 'low';
  }

  return {
    accountNumber,
    bank,
    detectedBankName,
    confidence,
    rawText,
  };
}

/** Extract ALL 10-digit account numbers from raw text. */
function extractAllAccountNumbers(rawText: string): string[] {
  const accounts = new Set<string>();

  // Spaced digit groups e.g. "6680 5795 54"
  const spacedPattern = /\d(?:[\d\s]{8,14}\d)/g;
  let match: RegExpExecArray | null;
  while ((match = spacedPattern.exec(rawText)) !== null) {
    const candidate = cleanAccountCandidate(match[0]);
    if (candidate) accounts.add(candidate);
  }

  // Contiguous 10-digit sequences
  const contiguous = rawText.match(/\b\d{10}\b/g);
  if (contiguous) {
    for (const c of contiguous) {
      accounts.add(c);
    }
  }

  return [...accounts];
}

/** Find the nearest bank name for an account number by line proximity. */
function findNearestBank(
  accountNumber: string,
  lines: string[],
  rawText: string,
): { bank: Bank | null; detectedBankName: string | null } {
  // Find the line index containing this account number
  const digits = accountNumber;
  let accountLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (digitsOnly(lines[i]).includes(digits)) {
      accountLineIdx = i;
      break;
    }
  }

  if (accountLineIdx === -1) {
    // Fallback: use full text match
    const { bank } = matchBankInText(rawText);
    return { bank, detectedBankName: null };
  }

  // Search outward from account line for bank references
  // Prefer lines AFTER the account number (typical layout: account then bank)
  const maxDistance = 5;
  let bestBank: Bank | null = null;
  let bestBankName: string | null = null;
  let bestDistance = Infinity;

  for (let d = 1; d <= maxDistance; d++) {
    // Check line after first (more likely to be the bank for this account)
    for (const offset of [d, -d]) {
      const idx = accountLineIdx + offset;
      if (idx < 0 || idx >= lines.length) continue;
      const line = lines[idx];
      const { bank } = matchBankInText(line);
      if (bank && d < bestDistance) {
        bestBank = bank;
        bestBankName = line;
        bestDistance = d;
      }
    }
    if (bestBank) break;
  }

  return { bank: bestBank, detectedBankName: bestBankName };
}

const MAX_ENTRIES = 5;

export function parseMultiplePaymentDetails(rawText: string): ParsedPaymentDetailsMulti {
  const lines = splitLines(rawText);
  const allAccounts = extractAllAccountNumbers(rawText);

  if (allAccounts.length === 0) {
    return { entries: [], confidence: 'low', rawText };
  }

  // Global bank only used as fallback when proximity matching fails
  const globalBankName = extractBankNameFromLabels(lines);
  const { bank: globalBank } = findBank(rawText, globalBankName);

  const entries: ParsedAccountEntry[] = [];
  const seen = new Set<string>();

  for (const acct of allAccounts) {
    if (seen.has(acct)) continue;
    seen.add(acct);

    // Always try proximity-based bank association per account
    const { bank, detectedBankName } = findNearestBank(acct, lines, rawText);
    entries.push({
      accountNumber: acct,
      bank: bank ?? (allAccounts.length === 1 ? globalBank : null),
      detectedBankName: detectedBankName ?? (allAccounts.length === 1 ? globalBankName : null),
    });

    if (entries.length >= MAX_ENTRIES) break;
  }

  const confidence: ParseConfidence =
    entries.length > 0 && entries.every((e) => e.bank) ? 'high' : 'low';

  return { entries, confidence, rawText };
}
