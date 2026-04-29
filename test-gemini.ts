import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyAvnftdjLoKU5Z-GwN8ykcH1nW0naSN7_I');

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("Hello, world!");
    console.log("Success:", result.response.text());
  } catch (error: any) {
    console.error("Gemini Error:", error.message);
  }
}

test();
