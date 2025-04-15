// "use server";

// import { db } from "@/lib/prisma";
// import { auth } from "@clerk/nextjs/server";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// export const generateAIInsights = async (industry) => {
//   const prompt = `
//           Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
//           {
//             "salaryRanges": [
//               { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
//             ],
//             "growthRate": number,
//             "demandLevel": "High" | "Medium" | "Low",
//             "topSkills": ["skill1", "skill2"],
//             "marketOutlook": "Positive" | "Neutral" | "Negative",
//             "keyTrends": ["trend1", "trend2"],
//             "recommendedSkills": ["skill1", "skill2"]
//           }
          
//           IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
//           Include at least 5 common roles for salary ranges.
//           Growth rate should be a percentage.
//           Include at least 5 skills and trends.
//         `;

//   const result = await model.generateContent(prompt);
//   const response = result.response;
//   const text = response.text();
//   const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
//   const insights = JSON.parse(cleanedText);

//   // Fix ENUM mapping for Prisma
//   const demandLevelMap = { High: "HIGH", Medium: "MEDIUM", Low: "LOW" };
//   const marketOutlookMap = {
//     Positive: "POSITIVE",
//     Neutral: "NEUTRAL",
//     Negative: "NEGATIVE",
//   };

//   insights.demandLevel = demandLevelMap[insights.demandLevel] || "MEDIUM"; // Default to "MEDIUM"
//   insights.marketOutlook =
//     marketOutlookMap[insights.marketOutlook] || "NEUTRAL"; // Default to "NEUTRAL"

//   return insights;
// };

// export async function getIndustryInsights() {
//   const { userId } = await auth();
//   if (!userId) throw new Error("Unauthorized");

//   const user = await db.user.findUnique({
//     where: { clerkUserId: userId },
//     include: {
//       industryInsight: true,
//     },
//   });

//   if (!user) throw new Error("User not found");

//   // If no insights exist, generate them
//   if (!user.industryInsight) {
//     const insights = await generateAIInsights(user.industry);

//     const industryInsight = await db.industryInsight.create({
//       data: {
//         industry: user.industry,
//         ...insights,
//         nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//       },
//     });

//     return industryInsight;
//   }

//   return user.industryInsight;
// }
"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateAIInsights = async (industry) => {
  const safeIndustry = industry || "null-industry";

  const prompt = `
    Analyze the current state of the ${safeIndustry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
    {
      "salaryRanges": [
        { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
      ],
      "growthRate": number,
      "demandLevel": "High" | "Medium" | "Low",
      "topSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
      "marketOutlook": "Positive" | "Neutral" | "Negative",
      "keyTrends": ["trend1", "trend2", "trend3", "trend4", "trend5"],
      "recommendedSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"]
    }

    IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = await response.text();
  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  let insights;
  try {
    insights = JSON.parse(cleanedText);
  } catch (error) {
    console.error("❌ JSON parsing failed:", error);
    return null;
  }

  // Fix ENUM mapping for Prisma
  const demandLevelMap = { High: "HIGH", Medium: "MEDIUM", Low: "LOW" };
  const marketOutlookMap = {
    Positive: "POSITIVE",
    Neutral: "NEUTRAL",
    Negative: "NEGATIVE",
  };

  insights.demandLevel = demandLevelMap[insights.demandLevel] || "MEDIUM";
  insights.marketOutlook =
    marketOutlookMap[insights.marketOutlook] || "NEUTRAL";

  return insights;
};

export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  // If no insights exist, generate them
  if (!user.industryInsight) {
    const insights = await generateAIInsights(user.industry);

    if (!insights) throw new Error("Failed to generate insights");

    const industryInsight = await db.industryInsight.create({
      data: {
        industry: user.industry || "Unknown",
        ...insights,
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return industryInsight;
  }

  return user.industryInsight;
}
