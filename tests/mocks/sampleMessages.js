/**
 * Sample email messages for testing
 */

module.exports = {
  // Standard DSN message
  dsnMessage: {
    messageId: 'dsn-001',
    subject: 'Delivery Status Notification (Failure)',
    body: `This is an automatically generated Delivery Status Notification.

Delivery to the following recipient failed permanently:

     invalid.user@nonexistent-domain.com

Technical details of permanent failure:
Google tried to deliver your message, but it was rejected by the server for the recipient domain nonexistent-domain.com.

----- Original message -----

Final-Recipient: rfc822; invalid.user@nonexistent-domain.com
Action: failed
Status: 5.1.1
Remote-MTA: dns; nonexistent-domain.com
Diagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.`,
    headers: {
      'X-Failed-Recipients': 'invalid.user@nonexistent-domain.com',
      'Content-Type': 'multipart/report; report-type=delivery-status'
    },
    from: 'mailer-daemon@googlemail.com',
    receivedDateTime: '2024-01-15T10:30:00Z'
  },

  // Office 365 bounce
  office365Bounce: {
    messageId: 'o365-001',
    subject: 'Undeliverable: Meeting Request',
    body: `Delivery has failed to these recipients or groups:

user@invalid-domain.xyz

The domain invalid-domain.xyz does not exist.

Diagnostic information for administrators:

Generating server: AM6PR03MB5123.eurprd03.prod.outlook.com

user@invalid-domain.xyz
Remote Server returned '550 5.1.10 RESOLVER.ADR.RecipientNotFound; Recipient not found by SMTP address lookup'

Original message headers:

From: sender@company.com
To: user@invalid-domain.xyz
Subject: Meeting Request
Date: Mon, 15 Jan 2024 10:00:00 +0000`,
    headers: {},
    from: 'postmaster@outlook.com',
    receivedDateTime: '2024-01-15T11:00:00Z'
  },

  // Multiple recipients bounce
  multiRecipientBounce: {
    messageId: 'multi-001',
    subject: 'Delivery Failure Report',
    body: `The following messages could not be delivered:

Final-Recipient: rfc822; user1@example.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550 User not found

Final-Recipient: rfc822; user2@example.com
Action: failed
Status: 5.2.1
Diagnostic-Code: smtp; 552 Mailbox over quota

Final-Recipient: rfc822; user3@example.com
Action: failed
Status: 5.1.2
Diagnostic-Code: smtp; 550 Domain not found`,
    headers: {
      'X-Failed-Recipients': 'user1@example.com, user2@example.com, user3@example.com'
    },
    from: 'mailer-daemon@smtp.example.com',
    receivedDateTime: '2024-01-15T12:00:00Z'
  },

  // Mailbox full
  mailboxFull: {
    messageId: 'full-001',
    subject: 'Mail delivery failed: returning message to sender',
    body: `This message was created automatically by mail delivery software.

A message that you sent could not be delivered to one or more of its
recipients. This is a permanent error.

Final-Recipient: rfc822; full.mailbox@example.com
Action: failed
Status: 5.2.2
Diagnostic-Code: smtp; 552 5.2.2 Over quota

The user's mailbox is full and cannot receive new messages.`,
    headers: {
      'X-Failed-Recipients': 'full.mailbox@example.com'
    },
    from: 'MAILER-DAEMON@mail.example.com',
    receivedDateTime: '2024-01-15T13:00:00Z'
  },

  // Spam blocked
  spamBlocked: {
    messageId: 'spam-001',
    subject: 'Undelivered Mail Returned to Sender',
    body: `This is the mail system at host smtp.example.com.

I'm sorry to have to inform you that your message could not
be delivered to one or more recipients. It's attached below.

<blocked@strict-domain.com>: host mx.strict-domain.com[192.0.2.1] said:
    550 5.7.1 Message rejected as spam by Content Filtering

Final-Recipient: rfc822; blocked@strict-domain.com
Action: failed
Status: 5.7.1
Diagnostic-Code: smtp; 550 5.7.1 Message rejected as spam`,
    headers: {},
    from: 'MAILER-DAEMON@smtp.example.com',
    receivedDateTime: '2024-01-15T14:00:00Z'
  },

  // Normal email (not a bounce)
  normalEmail: {
    messageId: 'normal-001',
    subject: 'Hello from the team',
    body: `Hi there,

Just wanted to check in and see how the project is going.

Let me know if you need anything!

Best regards,
John`,
    headers: {
      'Content-Type': 'text/plain'
    },
    from: 'john@company.com',
    receivedDateTime: '2024-01-15T15:00:00Z'
  }
};
