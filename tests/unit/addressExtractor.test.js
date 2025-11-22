const {
  extractFailedAddresses,
  extractFromHeader,
  extractFromDSN,
  extractFromBouncePatterns,
  extractDiagnostics,
  extractFailureReason
} = require('../../azure-func-lists/src/lib/addressExtractor');

describe('addressExtractor', () => {
  describe('extractFromHeader', () => {
    it('should extract address from X-Failed-Recipients header', () => {
      const headers = {
        'X-Failed-Recipients': 'test@example.com'
      };
      const result = extractFromHeader(headers);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('test@example.com');
      expect(result[0].source).toBe('header');
    });

    it('should handle lowercase header name', () => {
      const headers = {
        'x-failed-recipients': 'user@domain.org'
      };
      const result = extractFromHeader(headers);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('user@domain.org');
    });

    it('should extract multiple addresses', () => {
      const headers = {
        'X-Failed-Recipients': 'user1@test.com, user2@test.com'
      };
      const result = extractFromHeader(headers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for missing header', () => {
      const result = extractFromHeader({});
      expect(result).toHaveLength(0);
    });
  });

  describe('extractFromDSN', () => {
    it('should extract Final-Recipient from DSN', () => {
      const body = `
        Final-Recipient: rfc822; bounced@example.com
        Action: failed
        Status: 5.1.1
      `;
      const result = extractFromDSN(body);
      expect(result.some(r => r.address === 'bounced@example.com')).toBe(true);
    });

    it('should extract Original-Recipient from DSN', () => {
      const body = `
        Original-Recipient: rfc822; original@example.com
        Final-Recipient: rfc822; final@example.com
      `;
      const result = extractFromDSN(body);
      expect(result.some(r => r.address === 'original@example.com')).toBe(true);
      expect(result.some(r => r.address === 'final@example.com')).toBe(true);
    });

    it('should handle DSN without rfc822 prefix', () => {
      const body = 'Final-Recipient: user@domain.com';
      const result = extractFromDSN(body);
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('user@domain.com');
    });
  });

  describe('extractDiagnostics', () => {
    it('should extract status code', () => {
      const body = 'Status: 5.1.1';
      const result = extractDiagnostics(body);
      expect(result.statusCode).toBe('5.1.1');
    });

    it('should extract diagnostic code', () => {
      const body = 'Diagnostic-Code: smtp; 550 User not found';
      const result = extractDiagnostics(body);
      expect(result.diagnosticCode).toBe('550 User not found');
    });

    it('should extract action', () => {
      const body = 'Action: failed';
      const result = extractDiagnostics(body);
      expect(result.action).toBe('failed');
    });
  });

  describe('extractFromBouncePatterns', () => {
    it('should extract from "could not be delivered to" pattern', () => {
      const body = 'Your message could not be delivered to user@example.com';
      const result = extractFromBouncePatterns(body);
      expect(result.some(r => r.address === 'user@example.com')).toBe(true);
    });

    it('should extract from "The following recipient" pattern', () => {
      const body = 'The following recipient: test@domain.org';
      const result = extractFromBouncePatterns(body);
      expect(result.some(r => r.address === 'test@domain.org')).toBe(true);
    });

    it('should extract from "User unknown" pattern', () => {
      const body = 'User unknown: invalid@nowhere.com';
      const result = extractFromBouncePatterns(body);
      expect(result.some(r => r.address === 'invalid@nowhere.com')).toBe(true);
    });
  });

  describe('extractFailureReason', () => {
    it('should identify user not found', () => {
      const body = 'The email account that you tried to reach does not exist. User unknown.';
      const result = extractFailureReason(body);
      expect(result).toBe('User not found');
    });

    it('should identify mailbox full', () => {
      const body = 'Mailbox full. User quota exceeded.';
      const result = extractFailureReason(body);
      expect(result).toBe('Mailbox full');
    });

    it('should identify domain not found', () => {
      const body = 'Domain not found. DNS error.';
      const result = extractFailureReason(body);
      expect(result).toBe('Domain not found');
    });

    it('should return default for unknown reason', () => {
      const body = 'Some generic error occurred';
      const result = extractFailureReason(body);
      expect(result).toBe('Delivery failed');
    });
  });

  describe('extractFailedAddresses', () => {
    it('should combine addresses from all sources', () => {
      const message = {
        headers: {
          'X-Failed-Recipients': 'header@example.com'
        },
        body: `
          Final-Recipient: rfc822; dsn@example.com
          Your message could not be delivered to bounce@example.com
        `
      };
      const result = extractFailedAddresses(message);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should deduplicate addresses', () => {
      const message = {
        headers: {
          'X-Failed-Recipients': 'same@example.com'
        },
        body: 'could not be delivered to same@example.com'
      };
      const result = extractFailedAddresses(message);
      const addresses = result.map(r => r.address);
      const unique = [...new Set(addresses)];
      expect(addresses.length).toBe(unique.length);
    });

    it('should include failure reason and diagnostics', () => {
      const message = {
        headers: {},
        body: `
          Final-Recipient: rfc822; user@example.com
          Status: 5.1.1
          Diagnostic-Code: smtp; 550 User not found
        `
      };
      const result = extractFailedAddresses(message);
      expect(result[0].statusCode).toBe('5.1.1');
      expect(result[0].diagnosticCode).toContain('550');
      expect(result[0].failureReason).toBe('User not found');
    });

    it('should handle empty message', () => {
      const message = { headers: {}, body: '' };
      const result = extractFailedAddresses(message);
      expect(result).toHaveLength(0);
    });

    it('should normalize addresses to lowercase', () => {
      const message = {
        headers: {
          'X-Failed-Recipients': 'USER@EXAMPLE.COM'
        },
        body: ''
      };
      const result = extractFailedAddresses(message);
      expect(result[0].address).toBe('user@example.com');
    });
  });
});
