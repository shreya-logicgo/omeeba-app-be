import fs from 'fs/promises';
import path from 'path';
import { StatusCodes } from 'http-status-codes';

class LegalService {
  constructor() {
    this.staticPagesPath = path.join(process.cwd(), 'static-pages');
  }

  async getPrivacyPolicy() {
    try {
      const filePath = path.join(this.staticPagesPath, 'privacy.html');
      const content = await fs.readFile(filePath, 'utf8');
      return {
        success: true,
        content,
        type: 'privacy_policy'
      };
    } catch (error) {
      throw new Error('Privacy policy not found');
    }
  }

  async getTermsAndConditions() {
    try {
      const filePath = path.join(this.staticPagesPath, 'terms.html');
      const content = await fs.readFile(filePath, 'utf8');
      return {
        success: true,
        content,
        type: 'terms_and_conditions'
      };
    } catch (error) {
      throw new Error('Terms and conditions not found');
    }
  }
}

export default new LegalService();
