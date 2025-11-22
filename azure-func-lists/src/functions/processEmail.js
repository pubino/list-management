const { app } = require('@azure/functions');
const { extractFailedAddresses } = require('../lib/addressExtractor');

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

      // Extract failed addresses
      const extractedAddresses = extractFailedAddresses(message);

      const response = {
        success: true,
        messageId: message.messageId,
        extractedAddresses,
        processingDetails: `Extracted ${extractedAddresses.length} failed address(es) from message`
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
