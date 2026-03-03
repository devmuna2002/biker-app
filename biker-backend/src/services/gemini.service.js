const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Intelligent Dispatch Request using Gemini AI
 * @param {Object} orderData - Data about the order and available riders
 * @returns {Promise<Object>} - Ranked rider recommendations
 */
async function dispatchAI(orderData) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const prompt = `
Intelligent Dispatch Request for Bike Delivery Platform:

Order Details:
${JSON.stringify(orderData.order, null, 2)}

Available Riders:
${JSON.stringify(orderData.riders, null, 2)}

Task:
Rank the riders based on distance, current workload (active orders), rating, and capacity.
Consider potential traffic delays.

Return ONLY a structured JSON object with the following format:
{
    "ranked_riders": [
        { "rider_id": "uuid", "score": 0.95, "reason": "reasoning" },
        ...
    ],
    "selected_rider": "uuid",
    "confidence_score": 0.85,
    "time_saved_minutes": 5.2
}
`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown if present in response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini AI Dispatch Error:", error);
        throw error;
    }
}

module.exports = {
    dispatchAI
};
