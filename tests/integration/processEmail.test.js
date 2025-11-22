/**
 * Integration tests for processEmail function
 * Tests the HTTP endpoint with various message types
 */

// Mock Azure Functions context
const createMockContext = () => ({
  log: jest.fn(),
  error: jest.fn()
});

// Mock request object
const createMockRequest = (body) => ({
  json: jest.fn().mockResolvedValue(body)
});

// Import the handler directly for testing
const { extractFailedAddresses } = require('../../azure-func-lists/src/lib/addressExtractor');

describe('processEmail Integration', () => {
  describe('Full message processing', () => {
    it('should process a complete DSN message', async () => {
      const message = {
        messageId: 'msg-123',
        subject: 'Delivery Status Notification (Failure)',
        body: `
          This is an automatically generated Delivery Status Notification.

          Delivery to the following recipient failed permanently:

          Final-Recipient: rfc822; invalid.user@nonexistent-domain.com
          Action: failed
          Status: 5.1.1
          Diagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.
        `,
        headers: {
          'X-Failed-Recipients': 'invalid.user@nonexistent-domain.com'
        },
        from: 'mailer-daemon@google.com',
        receivedDateTime: '2024-01-15T10:30:00Z'
      };

      const result = extractFailedAddresses(message);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].address).toBe('invalid.user@nonexistent-domain.com');
      expect(result[0].statusCode).toBe('5.1.1');
      expect(result[0].failureReason).toBe('User not found');
    });

    it('should process Office 365 bounce message', async () => {
      const message = {
        messageId: 'msg-456',
        subject: 'Undeliverable: Test Email',
        body: `
          Delivery has failed to these recipients or groups:

          user@invalid-domain.xyz

          The domain invalid-domain.xyz does not exist.

          Diagnostic information for administrators:
          Generating server: outlook.office365.com

          user@invalid-domain.xyz
          Remote Server returned '550 5.1.10 RESOLVER.ADR.RecipientNotFound'
        `,
        headers: {},
        from: 'postmaster@outlook.com',
        receivedDateTime: '2024-01-15T11:00:00Z'
      };

      const result = extractFailedAddresses(message);

      expect(result.length).toBeGreaterThan(0);
      const addresses = result.map(r => r.address);
      expect(addresses).toContain('user@invalid-domain.xyz');
    });

    it('should process message with multiple failed recipients', async () => {
      const message = {
        messageId: 'msg-789',
        subject: 'Delivery Failure',
        body: `
          The following recipients could not receive this message:

          Final-Recipient: rfc822; user1@example.com
          Status: 5.1.1

          Final-Recipient: rfc822; user2@example.com
          Status: 5.2.1

          Final-Recipient: rfc822; user3@example.com
          Status: 5.1.2
        `,
        headers: {
          'X-Failed-Recipients': 'user1@example.com, user2@example.com, user3@example.com'
        },
        from: 'mailer-daemon@server.com',
        receivedDateTime: '2024-01-15T12:00:00Z'
      };

      const result = extractFailedAddresses(message);

      expect(result.length).toBe(3);
      const addresses = result.map(r => r.address);
      expect(addresses).toContain('user1@example.com');
      expect(addresses).toContain('user2@example.com');
      expect(addresses).toContain('user3@example.com');
    });

    it('should handle mailbox full errors', async () => {
      const message = {
        messageId: 'msg-full',
        subject: 'Delivery Status Notification',
        body: `
          Final-Recipient: rfc822; full.mailbox@example.com
          Action: failed
          Status: 5.2.2
          Diagnostic-Code: smtp; 552 Mailbox full - user quota exceeded
        `,
        headers: {},
        from: 'postmaster@example.com',
        receivedDateTime: '2024-01-15T13:00:00Z'
      };

      const result = extractFailedAddresses(message);

      expect(result[0].address).toBe('full.mailbox@example.com');
      expect(result[0].failureReason).toBe('Mailbox full');
    });

    it('should handle Gmail bounce format', async () => {
      const message = {
        messageId: 'msg-gmail',
        subject: 'Delivery Status Notification (Failure)',
        body: `
          ** Address not found **

          Your message wasn't delivered to unknown@gmail.com because the address couldn't be found, or is unable to receive mail.

          The response from the remote server was:
          550-5.1.1 The email account that you tried to reach does not exist. Please try
          550-5.1.1 double-checking the recipient's email address for typos or
          550 5.1.1 unnecessary spaces.
        `,
        headers: {
          'X-Failed-Recipients': 'unknown@gmail.com'
        },
        from: 'mailer-daemon@googlemail.com',
        receivedDateTime: '2024-01-15T14:00:00Z'
      };

      const result = extractFailedAddresses(message);

      expect(result[0].address).toBe('unknown@gmail.com');
      expect(result[0].failureReason).toBe('User not found');
    });

    it('should return empty array for non-bounce message', async () => {
      const message = {
        messageId: 'msg-normal',
        subject: 'Hello',
        body: 'This is a normal email message with no bounce information.',
        headers: {},
        from: 'sender@example.com',
        receivedDateTime: '2024-01-15T15:00:00Z'
      };

      const result = extractFailedAddresses(message);

      expect(result).toHaveLength(0);
    });
  });
});
