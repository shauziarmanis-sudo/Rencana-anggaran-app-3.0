import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the API client
const genAI = new GoogleGenerativeAI('AIzaSyAvnftdjLoKU5Z-GwN8ykcH1nW0naSN7_I');

async function test() {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAvnftdjLoKU5Z-GwN8ykcH1nW0naSN7_I');
    const data = await response.json();
    console.log("Models:", data);
  } catch (error: any) {
    console.error("Gemini Error:", error.message);
  }
}

test();
