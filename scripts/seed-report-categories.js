/**
 * Seed Script for Report Categories and Sub-Categories
 * 
 * This script populates the database with report categories and sub-categories
 * based on the report flow shown in the app screens.
 * 
 * Usage: node scripts/seed-report-categories.js
 */

import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/database.js";
import { ReportCategory, ReportSubCategory } from "../src/models/index.js";
import logger from "../src/utils/logger.js";

// Report categories data
const categories = [
  {
    name: "Spam or Misleading",
    description: "Report content that is spam or misleading",
    displayOrder: 1,
  },
  {
    name: "Nudity or Sexual Content",
    description: "Report inappropriate nudity or sexual content",
    displayOrder: 2,
  },
  {
    name: "Hate Speech or Symbols",
    description: "Report hate speech or offensive symbols",
    displayOrder: 3,
  },
  {
    name: "Violence or Dangerous Acts",
    description: "Report violent or dangerous content",
    displayOrder: 4,
  },
  {
    name: "Child Abuse / Exploitation",
    description: "Report content involving child abuse or exploitation. High severity - auto-flagged.",
    displayOrder: 5,
  },
  {
    name: "False Information / Fake News",
    description: "Report false information or fake news",
    displayOrder: 6,
  },
  {
    name: "Drugs / Illegal Activities",
    description: "Report content related to drugs or illegal activities",
    displayOrder: 7,
  },
  {
    name: "Privacy Violation",
    description: "Report content that violates privacy",
    displayOrder: 8,
  },
  {
    name: "Scam / Fraud",
    description: "Report scam or fraudulent content",
    displayOrder: 9,
  },
  {
    name: "Copyright Infringement",
    description: "Report content that violates copyright",
    displayOrder: 10,
  },
];

// Sub-categories data
const subCategories = [
  // 1. Spam or Misleading
  {
    categoryName: "Spam or Misleading",
    name: "Fake engagement (likes, follows, views)",
    description: "Content uses fake engagement methods",
    displayOrder: 1,
  },
  {
    categoryName: "Spam or Misleading",
    name: "Scam links or phishing",
    description: "Content contains scam links or phishing attempts",
    displayOrder: 2,
  },
  {
    categoryName: "Spam or Misleading",
    name: "Repeated unwanted content",
    description: "Content is repeatedly posted unwanted material",
    displayOrder: 3,
  },
  {
    categoryName: "Spam or Misleading",
    name: "Impersonation",
    description: "Content impersonates another person or entity",
    displayOrder: 4,
  },
  {
    categoryName: "Spam or Misleading",
    name: "Misleading claims",
    description: "Content contains misleading or false claims",
    displayOrder: 5,
  },
  {
    categoryName: "Spam or Misleading",
    name: "Clickbait",
    description: "Content uses clickbait tactics",
    displayOrder: 6,
  },
  {
    categoryName: "Spam or Misleading",
    name: "Other",
    description: "Other spam or misleading content",
    displayOrder: 7,
  },
  
  // 2. Nudity or Sexual Content
  {
    categoryName: "Nudity or Sexual Content",
    name: "Explicit sexual acts",
    description: "Content shows explicit sexual acts",
    displayOrder: 1,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Pornographic content",
    description: "Content contains pornographic material",
    displayOrder: 2,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Sexual solicitation",
    description: "Content solicits sexual services or activities",
    displayOrder: 3,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Fetish content",
    description: "Content contains fetish-related material",
    displayOrder: 4,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Non-consensual sexual content",
    description: "Content shows non-consensual sexual material",
    displayOrder: 5,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Adult nudity",
    description: "Content contains adult nudity",
    displayOrder: 6,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Sexual content involving minors",
    description: "Content involves sexual material with minors",
    displayOrder: 7,
  },
  {
    categoryName: "Nudity or Sexual Content",
    name: "Other",
    description: "Other nudity or sexual content",
    displayOrder: 8,
  },
  
  // 3. Hate Speech or Symbols
  {
    categoryName: "Hate Speech or Symbols",
    name: "Hate speech toward a protected group",
    description: "Content contains hate speech targeting protected groups",
    displayOrder: 1,
  },
  {
    categoryName: "Hate Speech or Symbols",
    name: "Hate symbols (e.g., extremist symbols)",
    description: "Content displays hate symbols or extremist symbols",
    displayOrder: 2,
  },
  {
    categoryName: "Hate Speech or Symbols",
    name: "Dehumanizing language",
    description: "Content uses dehumanizing language",
    displayOrder: 3,
  },
  {
    categoryName: "Hate Speech or Symbols",
    name: "Incitement of hatred",
    description: "Content incites hatred toward groups or individuals",
    displayOrder: 4,
  },
  {
    categoryName: "Hate Speech or Symbols",
    name: "Praise or support of hate groups",
    description: "Content praises or supports hate groups",
    displayOrder: 5,
  },
  {
    categoryName: "Hate Speech or Symbols",
    name: "Other",
    description: "Other hate speech or symbols",
    displayOrder: 6,
  },
  
  // 4. Violence or Dangerous Acts
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Threats of violence",
    description: "Content contains threats of violence",
    displayOrder: 1,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Physical assault",
    description: "Content shows or promotes physical assault",
    displayOrder: 2,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Use of weapons",
    description: "Content shows or promotes weapon use",
    displayOrder: 3,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Graphic violence",
    description: "Content contains graphic violent material",
    displayOrder: 4,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Self-harm or suicide",
    description: "Content promotes or shows self-harm or suicide",
    displayOrder: 5,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Animal abuse",
    description: "Content shows or promotes animal abuse",
    displayOrder: 6,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Dangerous challenges or stunts",
    description: "Content promotes dangerous challenges or stunts",
    displayOrder: 7,
  },
  {
    categoryName: "Violence or Dangerous Acts",
    name: "Other",
    description: "Other violence or dangerous acts",
    displayOrder: 8,
  },
  
  // 5. Child Abuse / Exploitation (High Severity - Auto-flagged)
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Sexual content involving minors",
    description: "Content contains sexual material involving minors",
    displayOrder: 1,
  },
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Child grooming",
    description: "Content involves child grooming behavior",
    displayOrder: 2,
  },
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Exploitation or trafficking",
    description: "Content involves child exploitation or trafficking",
    displayOrder: 3,
  },
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Physical abuse of a child",
    description: "Content shows or promotes physical abuse of children",
    displayOrder: 4,
  },
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Emotional abuse of a child",
    description: "Content shows or promotes emotional abuse of children",
    displayOrder: 5,
  },
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Neglect or endangerment",
    description: "Content shows child neglect or endangerment",
    displayOrder: 6,
  },
  {
    categoryName: "Child Abuse / Exploitation",
    name: "Other",
    description: "Other child abuse or exploitation",
    displayOrder: 7,
  },
  
  // 6. False Information / Fake News
  {
    categoryName: "False Information / Fake News",
    name: "Health misinformation",
    description: "Content contains false health information",
    displayOrder: 1,
  },
  {
    categoryName: "False Information / Fake News",
    name: "Political misinformation",
    description: "Content contains false political information",
    displayOrder: 2,
  },
  {
    categoryName: "False Information / Fake News",
    name: "Fake emergency alerts",
    description: "Content contains fake emergency or alert information",
    displayOrder: 3,
  },
  {
    categoryName: "False Information / Fake News",
    name: "Doctored or manipulated media",
    description: "Content contains doctored or manipulated media",
    displayOrder: 4,
  },
  {
    categoryName: "False Information / Fake News",
    name: "False claims presented as facts",
    description: "Content presents false claims as facts",
    displayOrder: 5,
  },
  {
    categoryName: "False Information / Fake News",
    name: "Other",
    description: "Other false information or fake news",
    displayOrder: 6,
  },
  
  // 7. Drugs / Illegal Activities
  {
    categoryName: "Drugs / Illegal Activities",
    name: "Drug use or promotion",
    description: "Content shows or promotes drug use",
    displayOrder: 1,
  },
  {
    categoryName: "Drugs / Illegal Activities",
    name: "Sale or distribution of drugs",
    description: "Content promotes sale or distribution of drugs",
    displayOrder: 2,
  },
  {
    categoryName: "Drugs / Illegal Activities",
    name: "Instructions for illegal activities",
    description: "Content provides instructions for illegal activities",
    displayOrder: 3,
  },
  {
    categoryName: "Drugs / Illegal Activities",
    name: "Promotion of illegal substances",
    description: "Content promotes illegal substances",
    displayOrder: 4,
  },
  {
    categoryName: "Drugs / Illegal Activities",
    name: "Weapons trade",
    description: "Content promotes weapons trade or sale",
    displayOrder: 5,
  },
  {
    categoryName: "Drugs / Illegal Activities",
    name: "Other",
    description: "Other drugs or illegal activities",
    displayOrder: 6,
  },
  
  // 8. Privacy Violation
  {
    categoryName: "Privacy Violation",
    name: "Sharing private personal information",
    description: "Content shares private personal information without consent",
    displayOrder: 1,
  },
  {
    categoryName: "Privacy Violation",
    name: "Doxxing",
    description: "Content contains doxxing information",
    displayOrder: 2,
  },
  {
    categoryName: "Privacy Violation",
    name: "Non-consensual images or videos",
    description: "Content contains non-consensual images or videos",
    displayOrder: 3,
  },
  {
    categoryName: "Privacy Violation",
    name: "Stolen identity information",
    description: "Content contains stolen identity information",
    displayOrder: 4,
  },
  {
    categoryName: "Privacy Violation",
    name: "Surveillance or stalking",
    description: "Content involves surveillance or stalking",
    displayOrder: 5,
  },
  {
    categoryName: "Privacy Violation",
    name: "Other",
    description: "Other privacy violations",
    displayOrder: 6,
  },
  
  // 9. Scam / Fraud
  {
    categoryName: "Scam / Fraud",
    name: "Financial scam",
    description: "Content promotes financial scams",
    displayOrder: 1,
  },
  {
    categoryName: "Scam / Fraud",
    name: "Investment fraud",
    description: "Content promotes investment fraud",
    displayOrder: 2,
  },
  {
    categoryName: "Scam / Fraud",
    name: "Crypto or NFT scam",
    description: "Content promotes cryptocurrency or NFT scams",
    displayOrder: 3,
  },
  {
    categoryName: "Scam / Fraud",
    name: "Impersonation for money",
    description: "Content involves impersonation for financial gain",
    displayOrder: 4,
  },
  {
    categoryName: "Scam / Fraud",
    name: "Fake giveaways or prizes",
    description: "Content promotes fake giveaways or prizes",
    displayOrder: 5,
  },
  {
    categoryName: "Scam / Fraud",
    name: "Identity theft",
    description: "Content involves identity theft",
    displayOrder: 6,
  },
  {
    categoryName: "Scam / Fraud",
    name: "Other",
    description: "Other scams or fraud",
    displayOrder: 7,
  },
  
  // 10. Copyright Infringement
  {
    categoryName: "Copyright Infringement",
    name: "Unauthorized use of music",
    description: "Content uses music without authorization",
    displayOrder: 1,
  },
  {
    categoryName: "Copyright Infringement",
    name: "Unauthorized use of video",
    description: "Content uses video without authorization",
    displayOrder: 2,
  },
  {
    categoryName: "Copyright Infringement",
    name: "Unauthorized use of images",
    description: "Content uses images without authorization",
    displayOrder: 3,
  },
  {
    categoryName: "Copyright Infringement",
    name: "Reuploaded copyrighted content",
    description: "Content is reuploaded copyrighted material",
    displayOrder: 4,
  },
  {
    categoryName: "Copyright Infringement",
    name: "Pirated content",
    description: "Content contains pirated material",
    displayOrder: 5,
  },
  {
    categoryName: "Copyright Infringement",
    name: "Other",
    description: "Other copyright infringement",
    displayOrder: 6,
  },
];

/**
 * Seed report categories
 */
const seedCategories = async () => {
  try {
    logger.info("Starting to seed report categories...");

    // Clear existing categories
    await ReportCategory.deleteMany({});
    logger.info("Cleared existing report categories");

    // Insert categories
    const createdCategories = await ReportCategory.insertMany(categories);
    logger.info(`Created ${createdCategories.length} report categories`);

    return createdCategories;
  } catch (error) {
    logger.error("Error seeding categories:", error);
    throw error;
  }
};

/**
 * Seed report sub-categories
 */
const seedSubCategories = async (categories) => {
  try {
    logger.info("Starting to seed report sub-categories...");

    // Clear existing sub-categories
    await ReportSubCategory.deleteMany({});
    logger.info("Cleared existing report sub-categories");

    // Create a map of category names to IDs
    const categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat.name] = cat._id;
    });

    // Prepare sub-categories with category IDs
    const subCategoriesToInsert = subCategories.map((subCat) => {
      const categoryId = categoryMap[subCat.categoryName];
      if (!categoryId) {
        throw new Error(`Category not found: ${subCat.categoryName}`);
      }
      return {
        categoryId: categoryId,
        name: subCat.name,
        description: subCat.description,
        displayOrder: subCat.displayOrder,
      };
    });

    // Insert sub-categories
    const createdSubCategories = await ReportSubCategory.insertMany(
      subCategoriesToInsert
    );
    logger.info(
      `Created ${createdSubCategories.length} report sub-categories`
    );

    return createdSubCategories;
  } catch (error) {
    logger.error("Error seeding sub-categories:", error);
    throw error;
  }
};

/**
 * Main seed function
 */
const seedReportCategories = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info("Connected to database");

    // Seed categories
    const categories = await seedCategories();

    // Seed sub-categories
    await seedSubCategories(categories);

    logger.info("✅ Successfully seeded report categories and sub-categories!");

    // Display summary
    const allCategories = await ReportCategory.find({ isActive: true }).sort({
      displayOrder: 1,
    });
    const allSubCategories = await ReportSubCategory.find({ isActive: true })
      .populate("categoryId", "name")
      .sort({ displayOrder: 1 });

    console.log("\n📊 Summary:");
    console.log(`Categories: ${allCategories.length}`);
    console.log(`Sub-Categories: ${allSubCategories.length}`);

    console.log("\n📋 Categories:");
    allCategories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name}`);
    });

    console.log("\n📋 Sub-Categories by Category:");
    const categoriesMap = {};
    allSubCategories.forEach((subCat) => {
      const catName = subCat.categoryId.name;
      if (!categoriesMap[catName]) {
        categoriesMap[catName] = [];
      }
      categoriesMap[catName].push(subCat);
    });
    
    Object.keys(categoriesMap).forEach((catName) => {
      console.log(`\n${catName}:`);
      categoriesMap[catName].forEach((subCat, index) => {
        console.log(`  ${index + 1}. ${subCat.name}`);
      });
    });
  } catch (error) {
    logger.error("Error in seed script:", error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await disconnectDB();
    logger.info("Disconnected from database");
    process.exit(0);
  }
};

// Run the seed script
seedReportCategories();
