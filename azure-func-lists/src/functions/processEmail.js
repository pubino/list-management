const { app } = require('@azure/functions');
const { extractFailedAddresses, extractFromAttachments } = require('../lib/addressExtractor');

app.http('processEmail', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('Processing email delivery failure notification');

    try {
      const message = await request.json();

      // Validate required fields
      if (!message.messageId) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: 'Missing required field: messageId'
          }
        };
      }

      // Extract failed addresses from message body
      const bodyAddresses = extractFailedAddresses(message);

      // Extract failed addresses from attachments (.eml files, etc.)
      const attachmentAddresses = extractFromAttachments(message.attachments || []);

      // Combine and deduplicate
      const addressMap = new Map();
      for (const addr of [...bodyAddresses, ...attachmentAddresses]) {
        if (!addressMap.has(addr.address)) {
          addressMap.set(addr.address, addr);
        }
      }
      const extractedAddresses = Array.from(addressMap.values());

      const response = {
        success: true,
        messageId: message.messageId,
        extractedAddresses,
        processingDetails: `Extracted ${extractedAddresses.length} failed address(es) from message (body: ${bodyAddresses.length}, attachments: ${attachmentAddresses.length})`
      };

      context.log(`Successfully processed message ${message.messageId}, found ${extractedAddresses.length} addresses`);

      return {
        status: 200,
        jsonBody: response
      };

    } catch (error) {
      context.error('Error processing email:', error);

      return {
        status: 500,
        jsonBody: {
          success: false,
          error: error.message || 'Internal server error'
        }
      };
    }
  }
});
