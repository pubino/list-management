const {
  extractFailedAddresses,
  extractFromHeader,
  extractFromDSN,
  extractFromBouncePatterns,
  extractDiagnostics,
  extractFailureReason,
  extractFromAttachments,
  parseEmlContent
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

  describe('parseEmlContent', () => {
    it('should parse headers and body from .eml content', () => {
      const emlContent = `From: sender@example.com
To: recipient@example.com
Subject: Test Email
X-Failed-Recipients: failed@example.com

This is the body of the email.`;
      const result = parseEmlContent(emlContent);
      expect(result.headers['from']).toBe('sender@example.com');
      expect(result.headers['to']).toBe('recipient@example.com');
      expect(result.headers['x-failed-recipients']).toBe('failed@example.com');
      expect(result.body).toContain('This is the body');
    });

    it('should handle multi-line headers', () => {
      const emlContent = `Subject: This is a very long subject
 that continues on the next line
From: sender@example.com

Body text`;
      const result = parseEmlContent(emlContent);
      expect(result.headers['subject']).toContain('continues on the next line');
    });
  });

  describe('extractFromAttachments', () => {
    it('should extract addresses from .eml attachment', () => {
      const emlContent = `From: mailer-daemon@example.com
To: sender@example.com
X-Failed-Recipients: bounced@example.com

Final-Recipient: rfc822; bounced@example.com
Status: 5.1.1
Diagnostic-Code: smtp; 550 User not found`;

      const attachments = [{
        name: 'bounce.eml',
        contentType: 'message/rfc822',
        content: emlContent
      }];

      const result = extractFromAttachments(attachments);
      expect(result.some(r => r.address === 'bounced@example.com')).toBe(true);
    });

    it('should extract addresses from base64 encoded attachment', () => {
      const emlContent = `X-Failed-Recipients: encoded@example.com

Final-Recipient: rfc822; encoded@example.com`;
      const base64Content = Buffer.from(emlContent).toString('base64');

      const attachments = [{
        name: 'bounce.eml',
        contentType: 'message/rfc822; base64',
        content: base64Content
      }];

      const result = extractFromAttachments(attachments);
      expect(result.some(r => r.address === 'encoded@example.com')).toBe(true);
    });

    it('should extract addresses from plain text attachment', () => {
      const textContent = `Final-Recipient: rfc822; text@example.com
Status: 5.1.1`;

      const attachments = [{
        name: 'bounce.txt',
        contentType: 'text/plain',
        content: textContent
      }];

      const result = extractFromAttachments(attachments);
      expect(result.some(r => r.address === 'text@example.com')).toBe(true);
    });

    it('should handle multiple attachments', () => {
      const attachments = [
        {
          name: 'bounce1.eml',
          contentType: 'message/rfc822',
          content: 'X-Failed-Recipients: user1@example.com\n\nBody'
        },
        {
          name: 'bounce2.eml',
          contentType: 'message/rfc822',
          content: 'X-Failed-Recipients: user2@example.com\n\nBody'
        }
      ];

      const result = extractFromAttachments(attachments);
      expect(result.some(r => r.address === 'user1@example.com')).toBe(true);
      expect(result.some(r => r.address === 'user2@example.com')).toBe(true);
    });

    it('should deduplicate addresses across attachments', () => {
      const attachments = [
        {
          name: 'bounce1.eml',
          contentType: 'message/rfc822',
          content: 'X-Failed-Recipients: same@example.com\n\nBody'
        },
        {
          name: 'bounce2.eml',
          contentType: 'message/rfc822',
          content: 'X-Failed-Recipients: same@example.com\n\nBody'
        }
      ];

      const result = extractFromAttachments(attachments);
      const addresses = result.filter(r => r.address === 'same@example.com');
      expect(addresses).toHaveLength(1);
    });

    it('should return empty array for empty attachments', () => {
      const result = extractFromAttachments([]);
      expect(result).toHaveLength(0);
    });

    it('should skip attachments without content', () => {
      const attachments = [
        { name: 'empty.eml', contentType: 'message/rfc822' }
      ];
      const result = extractFromAttachments(attachments);
      expect(result).toHaveLength(0);
    });

    it('should include attachment name in source', () => {
      const attachments = [{
        name: 'bounce.eml',
        contentType: 'message/rfc822',
        content: 'X-Failed-Recipients: test@example.com\n\nBody'
      }];

      const result = extractFromAttachments(attachments);
      expect(result[0].attachmentName).toBe('bounce.eml');
    });
  });
});
