import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePaymentDetails } from './parsePaymentDetails';

const MONIEPOINT_OCR = `Bank
Bank Account Name
Account Number
Moniepoint Microfinance Bank
MONNIFY / Majatech-AJI
6680 5795 54
Copy`;

describe('parsePaymentDetails', () => {
  it('parses Moniepoint slip with spaced account number', () => {
    const result = parsePaymentDetails(MONIEPOINT_OCR);

    assert.equal(result.accountNumber, '6680579554');
    assert.equal(result.detectedBankName, 'Moniepoint Microfinance Bank');
    assert.equal(result.bank?.id, '7');
    assert.equal(result.bank?.name, 'Moniepoint Microfinance Bank');
  });

  it('parses contiguous 10-digit account as fallback', () => {
    const result = parsePaymentDetails('Pay to 0123456789 at GTBank');
    assert.equal(result.accountNumber, '0123456789');
    assert.equal(result.bank?.id, '2');
  });

  it('does not false-match Kuda from generic microfinance text alone', () => {
    const result = parsePaymentDetails(
      'Some Microfinance Bank\nAccount Number\n1234567890',
    );
    assert.equal(result.accountNumber, '1234567890');
    assert.notEqual(result.bank?.id, '6');
  });

  it('extracts bank from label when not in list', () => {
    const result = parsePaymentDetails(`Bank
Unknown New Bank Ltd
Account Number
9876543210`);
    assert.equal(result.accountNumber, '9876543210');
    assert.equal(result.detectedBankName, 'Unknown New Bank Ltd');
    assert.equal(result.bank, null);
  });
});
