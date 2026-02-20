
import { GoogleGenAI } from "@google/genai";

// Fix: Updated initialization to strictly follow guidelines using process.env.API_KEY directly without fallback
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Fix: Updated to use 'gemini-3-flash-preview' for basic text tasks (menu descriptions)
 * and ensured property access for response text.
 */
export const generateMenuDescription = async (dishName: string, ingredients: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a short, appetizing menu description (max 20 words) for a dish named "${dishName}" containing: ${ingredients}.`,
    });
    return response.text?.trim() || "Delicious and fresh ingredients.";
  } catch (error) {
    console.error("Error generating description:", error);
    return "Delicious and fresh ingredients prepared daily.";
  }
};

export interface GroundingResult {
  text: string;
  links: { title: string; uri: string }[];
}

/**
 * Fix: Maintained 'gemini-2.5-flash' for Maps grounding as required by documentation.
 * Used response.text property for content extraction.
 */
export const askLocationAssistant = async (query: string, userLocation?: { lat: number; lng: number }): Promise<GroundingResult> => {
  try {
    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    // If user location is provided, pass it to grounding for better context
    if (userLocation) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: config,
    });

    const text = response.text || "Não foi possível encontrar informações.";
    
    // Extract grounding chunks for source links
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const links: { title: string; uri: string }[] = [];

    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        links.push({ title: chunk.web.title || "Fonte Web", uri: chunk.web.uri });
      } else if (chunk.maps) {
        links.push({ title: chunk.maps.title || "Google Maps", uri: chunk.maps.uri });
      }
    });

    // Remove duplicates based on URI
    const uniqueLinks = Array.from(new Map(links.map(item => [item.uri, item])).values());

    return { text, links: uniqueLinks };
  } catch (error) {
    console.error("Error in location assistant:", error);
    return { text: "Ocorreu um erro ao consultar o assistente de localização.", links: [] };
  }
};
