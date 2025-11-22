/**
 * Extracts failed email addresses from delivery failure notifications
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extract addresses from X-Failed-Recipients header
 */
function extractFromHeader(headers) {
  const failedRecipients = headers?.['X-Failed-Recipients'] || headers?.['x-failed-recipients'];
  if (!failedRecipients) return [];

  const addresses = failedRecipients.match(EMAIL_REGEX) || [];
  return addresses.map(addr => ({
    address: addr.toLowerCase(),
    source: 'header'
  }));
}

/**
 * Parse DSN (Delivery Status Notification) format
 * RFC 3464 compliant
 */
function extractFromDSN(body) {
  const results = [];

  // Match Final-Recipient field
  const finalRecipientMatch = body.match(/Final-Recipient:\s*(?:rfc822;)?\s*([^\r\n]+)/gi);
  if (finalRecipientMatch) {
    for (const match of finalRecipientMatch) {
      const emails = match.match(EMAIL_REGEX);
      if (emails) {
        emails.forEach(email => {
          results.push({
            address: email.toLowerCase(),
            source: 'dsn-final-recipient'
          });
        });
      }
    }
  }

  // Match Original-Recipient field
  const originalRecipientMatch = body.match(/Original-Recipient:\s*(?:rfc822;)?\s*([^\r\n]+)/gi);
  if (originalRecipientMatch) {
    for (const match of originalRecipientMatch) {
      const emails = match.match(EMAIL_REGEX);
      if (emails) {
        emails.forEach(email => {
          results.push({
            address: email.toLowerCase(),
            source: 'dsn-original-recipient'
          });
        });
      }
    }
  }

  return results;
}

/**
 * Extract diagnostic codes and failure reasons from DSN
 */
function extractDiagnostics(body) {
  const diagnostics = {};

  // Status code (e.g., 5.1.1)
  const statusMatch = body.match(/Status:\s*(\d+\.\d+\.\d+)/i);
  if (statusMatch) {
    diagnostics.statusCode = statusMatch[1];
  }

  // Diagnostic code
  const diagMatch = body.match(/Diagnostic-Code:\s*(?:smtp;)?\s*([^\r\n]+)/i);
  if (diagMatch) {
    diagnostics.diagnosticCode = diagMatch[1].trim();
  }

  // Action (failed, delayed, etc.)
  const actionMatch = body.match(/Action:\s*(\w+)/i);
  if (actionMatch) {
    diagnostics.action = actionMatch[1].toLowerCase();
  }

  return diagnostics;
}

/**
 * Extract from common bounce message patterns
 */
function extractFromBouncePatterns(body) {
  const results = [];

  // Common patterns in bounce messages
  const patterns = [
    /(?:could not be delivered to|failed to deliver to|undeliverable to|rejected by|bounced from|Delivery has failed to)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /(?:The following recipient|Recipient address|these recipients or groups)[:\s]*\n*\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /(?:User unknown|Mailbox not found|Invalid recipient)\s*[:<]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>.*(?:failed|rejected|bounced|undeliverable)/gi,
    /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/gm
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      results.push({
        address: match[1].toLowerCase(),
        source: 'bounce-pattern'
      });
    }
  }

  return results;
}

/**
 * Extract failure reason from message body
 */
function extractFailureReason(body) {
  // Common failure reasons
  const reasonPatterns = [
    { pattern: /(?:user unknown|user not found|mailbox not found|no such user|does not exist|RecipientNotFound)/i, reason: 'User not found' },
    { pattern: /(?:mailbox full|over quota|quota exceeded)/i, reason: 'Mailbox full' },
    { pattern: /(?:domain not found|no mx record|dns error|domain.*does not exist)/i, reason: 'Domain not found' },
    { pattern: /(?:connection refused|connection timed out)/i, reason: 'Connection failed' },
    { pattern: /(?:blocked|blacklisted|spam)/i, reason: 'Blocked or blacklisted' },
    { pattern: /(?:invalid address|bad address)/i, reason: 'Invalid address format' },
    { pattern: /(?:relay denied|relaying not permitted)/i, reason: 'Relay denied' },
    { pattern: /(?:message too large|size limit exceeded)/i, reason: 'Message too large' }
  ];

  for (const { pattern, reason } of reasonPatterns) {
    if (pattern.test(body)) {
      return reason;
    }
  }

  return 'Delivery failed';
}

/**
 * Main extraction function - combines all methods
 */
function extractFailedAddresses(message) {
  const { body = '', headers = {} } = message;
  const addressMap = new Map();

  // Extract from all sources
  const headerAddresses = extractFromHeader(headers);
  const dsnAddresses = extractFromDSN(body);
  const bounceAddresses = extractFromBouncePatterns(body);

  // Combine and deduplicate
  const allAddresses = [...headerAddresses, ...dsnAddresses, ...bounceAddresses];

  for (const addrInfo of allAddresses) {
    if (!addressMap.has(addrInfo.address)) {
      addressMap.set(addrInfo.address, addrInfo);
    }
  }

  // Get diagnostics
  const diagnostics = extractDiagnostics(body);
  const failureReason = extractFailureReason(body);

  // Build results
  const results = [];
  for (const [address, info] of addressMap) {
    results.push({
      address,
      failureReason,
      diagnosticCode: diagnostics.diagnosticCode || null,
      statusCode: diagnostics.statusCode || null,
      source: info.source
    });
  }

  return results;
}

module.exports = {
  extractFailedAddresses,
  extractFromHeader,
  extractFromDSN,
  extractFromBouncePatterns,
  extractDiagnostics,
  extractFailureReason
};
