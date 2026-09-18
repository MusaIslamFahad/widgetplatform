const jobQueue = require('./jobQueue');
const emailService = require('./email.service');

jobQueue.registerHandler('send-confirmation-email', emailService.sendConfirmationEmail);

module.exports = jobQueue;
