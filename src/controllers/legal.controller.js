import { StatusCodes } from 'http-status-codes';
import legalService from '../services/legal.service.js';

class LegalController {
  async getPrivacyPolicy(req, res) {
    try {
      const result = await legalService.getPrivacyPolicy();
      res.setHeader('Content-Type', 'text/html');
      res.status(StatusCodes.OK).send(result.content);
    } catch (error) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }

  async getTermsAndConditions(req, res) {
    try {
      const result = await legalService.getTermsAndConditions();
      res.setHeader('Content-Type', 'text/html');
      res.status(StatusCodes.OK).send(result.content);
    } catch (error) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: error.message,
        data: null
      });
    }
  }
}

export default new LegalController();
