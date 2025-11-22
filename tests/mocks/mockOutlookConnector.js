/**
 * Mock Outlook connector for local testing
 * Simulates the Office 365 connection behavior
 */

const sampleMessages = require('./sampleMessages');

class MockOutlookConnector {
  constructor(options = {}) {
    this.folders = options.folders || ['Inbox', 'Bounces'];
    this.messages = options.messages || [
      sampleMessages.dsnMessage,
      sampleMessages.office365Bounce,
      sampleMessages.multiRecipientBounce
    ];
    this.messageIndex = 0;
    this.subscriptions = [];
  }

  /**
   * Get list of folders
   */
  async getFolders() {
    return this.folders.map((name, index) => ({
      id: `folder-${index}`,
      displayName: name,
      totalItemCount: this.messages.length
    }));
  }

  /**
   * Get messages from a folder
   */
  async getMessages(folderId, options = {}) {
    const { top = 10, skip = 0 } = options;
    return this.messages.slice(skip, skip + top);
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId) {
    return this.messages.find(m => m.messageId === messageId) || null;
  }

  /**
   * Subscribe to new messages (webhook simulation)
   */
  async subscribe(folderId, callbackUrl) {
    const subscription = {
      id: `sub-${Date.now()}`,
      folderId,
      callbackUrl,
      expirationDateTime: new Date(Date.now() + 3600000).toISOString()
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  /**
   * Simulate receiving a new message
   * Returns the message that would trigger the Logic App
   */
  simulateNewMessage(message = null) {
    const newMessage = message || this.messages[this.messageIndex % this.messages.length];
    this.messageIndex++;

    return {
      value: [{
        id: newMessage.messageId,
        folderId: 'folder-0',
        subject: newMessage.subject,
        body: {
          content: newMessage.body,
          contentType: 'text'
        },
        from: {
          emailAddress: {
            address: newMessage.from
          }
        },
        receivedDateTime: newMessage.receivedDateTime,
        internetMessageHeaders: Object.entries(newMessage.headers || {}).map(([name, value]) => ({
          name,
          value
        }))
      }]
    };
  }

  /**
   * Send an email (mock)
   */
  async sendEmail(to, subject, body, importance = 'Normal') {
    return {
      success: true,
      messageId: `sent-${Date.now()}`,
      to,
      subject,
      sentDateTime: new Date().toISOString()
    };
  }
}

/**
 * Create a mock trigger event
 */
function createTriggerEvent(message) {
  return {
    id: message.messageId,
    subject: message.subject,
    body: {
      content: message.body,
      contentType: 'text'
    },
    from: {
      emailAddress: {
        address: message.from
      }
    },
    receivedDateTime: message.receivedDateTime,
    internetMessageHeaders: Object.entries(message.headers || {}).map(([name, value]) => ({
      name,
      value
    }))
  };
}

module.exports = {
  MockOutlookConnector,
  createTriggerEvent
};
