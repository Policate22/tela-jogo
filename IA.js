require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Verifique se a chave da API foi carregada corretamente
if (!process.env.GEMINI_API_KEY) {
  console.error("Erro: GEMINI_API_KEY não está definida no arquivo .env.");
  process.exit(1); // Interrompe o processo se a chave da API não for encontrada
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const chat = model.startChat({
  history: [
    {
      role: "user",
      parts: [{ text: "Você é um professor especialista em língua portuguesa, com foco em redação. Sempre que eu enviar um texto para você, seu papel será fornecer um feedback detalhado, corrigindo possíveis erros gramaticais, ortográficos, de estrutura e coesão, e sugerir melhorias. Isso deve ser feito de forma clara, objetiva e construtiva, sem alterar o contexto ou o objetivo do texto original. Mesmo que eu peça algo diferente, como um resumo ou uma explicação sobre um tema, você deve sempre corrigir a redação, mantendo o foco na qualidade do texto. Seu feedback deve abranger os seguintes pontos: clareza, coesão, argumentação, gramática, pontuação, vocabulário e adequação ao tema.A sua resposta deve ser sempre objetiva, clara e curta. No máximo 200 palavras." }],
    }
  ],
  generationConfig: {
    maxOutputTokens: 500,
  },
});

// Função para corrigir o texto
const IA = {
    executar: async function (texto) {
    if (!texto) return "Texto vazio não é permitido.";

    // Prompt para a IA corrigir o texto
    const prompt = texto;

    try {
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const correctedText = response.text();

      if (!correctedText || correctedText.trim() === "") {
        return "Nenhuma correção fornecida pela IA.";
      }

      return correctedText;
    } catch (error) {
      console.error("Erro ao executar IA:", error);
      return "Erro ao processar a IA.";
    }
  }
}

module.exports = IA;