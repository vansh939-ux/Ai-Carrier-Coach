// import { db } from "../prisma";
// import { inngest } from "./client";


// //event is word which will trigger this function can also add retiries(how many times should try )
// //inngest func run step by step
// export const generateIndustryInsights = inngest.createFunction(
//   {name: "Generate Industry Insights"},
//   {cron: "0 0 * * 0"},
//   async({step})=>{
//     const industries = await step.run("Fetch Industries", async()=>{
//       return await db.industryInsights.findMany({
//         select:{industry:true},
//       });
//     });
//     for(const{industry} of industries){
//        const prompt = `
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
//         const res = await step.ai.wrap("gemini",async(p)=>{
//          return await model.generateContent(p);
//         },prompt)
//         const text = res.response.candidates[0].content.parts[0].text || "";
//         const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
//         const insights = JSON.parse(cleanedText);

//         await step.run(`Update ${industry} insights`,async()=>{
//           await generateAIInsights(industry);
          
//               const industryInsight = await db.industryInsight.update({
//                 where:{industry},
//                 data: {
                 
//                   ...insights,
//                   lastUpdated: new Date(),
//                   nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//                 },
//               })
//         })
//     }
//   }  
// )
import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // Run every Sunday at midnight
  async ({ event, step }) => {
    console.log("🚀 Starting Industry Insights Function");

    // Fetch industries from the database
    const industries = await step.run("Fetch industries", async () => {
      return await db.industryInsight.findMany({ select: { industry: true } });
    });

    console.log("📌 Industries to process:", industries);

    for (const { industry } of industries) {
      console.log(`🔍 Processing industry: ${industry}`);

      const prompt = `
        Analyze the ${industry} industry and provide insights in JSON format:
        {
          "salaryRanges": [{ "role": "string", "min": number, "max": number, "median": number, "location": "string" }],
          "growthRate": number,
          "demandLevel": "High" | "Medium" | "Low",
          "topSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
          "marketOutlook": "Positive" | "Neutral" | "Negative",
          "keyTrends": ["trend1", "trend2", "trend3", "trend4", "trend5"],
          "recommendedSkills": ["skill1", "skill2", "skill3", "skill4", "skill5"]
        }
        Return only JSON.
      `;

      const res = await step.ai.wrap(
        "gemini",
        async (p) => {
          try {
            return await model.generateContent(p);
          } catch (error) {
            console.error(`❌ Gemini API Error for ${industry}:`, error);
            return null;
          }
        },
        prompt
      );

      if (!res || !res.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error(`⚠️ No valid response for ${industry}`);
        continue;
      }

      // Extract response text
      const text = res.response.candidates[0].content.parts[0].text || "";
      console.log(`📝 Gemini Raw Response for ${industry}:`, text);

      // Clean and parse JSON response
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
      let insights;
      try {
        insights = JSON.parse(cleanedText);
        console.log(`✅ Parsed JSON Insights for ${industry}:`, insights);
      } catch (error) {
        console.error(`❌ JSON Parsing Error for ${industry}:`, error);
        continue;
      }

      // Ensure required fields are present and valid
      const isValid =
        insights &&
        typeof insights === "object" &&
        Object.keys(insights).length > 0;
      if (!isValid) {
        console.error(`⚠️ Skipping update for ${industry}: Invalid insights`);
        continue;
      }

      // Safeguard against undefined/null values
      const safeData = {
        salaryRanges: Array.isArray(insights.salaryRanges)
          ? insights.salaryRanges
          : [],
        growthRate:
          typeof insights.growthRate === "number" ? insights.growthRate : 0,
        demandLevel: ["HIGH", "MEDIUM", "LOW"].includes(
          insights.demandLevel?.toUpperCase()
        )
          ? insights.demandLevel.toUpperCase()
          : "MEDIUM",
        topSkills: Array.isArray(insights.topSkills) ? insights.topSkills : [],
        marketOutlook: ["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(
          insights.marketOutlook?.toUpperCase()
        )
          ? insights.marketOutlook.toUpperCase()
          : "NEUTRAL",
        keyTrends: Array.isArray(insights.keyTrends) ? insights.keyTrends : [],
        recommendedSkills: Array.isArray(insights.recommendedSkills)
          ? insights.recommendedSkills
          : [],
        lastUpdated: new Date(),
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next update in 7 days
      };

      // Update database with insights
      await step.run(`Update ${industry} insights`, async () => {
        try {
          console.log(`🛠 Updating insights for: ${industry}`);
          await db.industryInsight.update({
            where: { industry },
            data: safeData,
          });
          console.log(`✅ Successfully updated ${industry}`);
        } catch (error) {
          console.error(`❌ Prisma Update Error for ${industry}:`, error);
          throw error; // Ensure Inngest logs the error
        }
      });
    }
  }
);
