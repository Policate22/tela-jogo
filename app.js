// app.js
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const mammoth = require("mammoth");
const IA = require("./IA");

// Cria a pasta 'uploads' se não existir
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// Configura o express
const App = express();
App.set("view engine", "ejs");
App.set("views", path.join(__dirname, "mvc/views"));
App.use(express.static(path.join(__dirname, "publico")));
App.use('/uploads', express.static(uploadPath)); // Serve arquivos da pasta uploads
App.use(express.urlencoded({ extended: true }));
App.use(express.json());

// Configuração do multer para salvar arquivos em 'uploads'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Página principal
App.get("/", (req, res) => {
  res.render("index.ejs", { 
    chat: '',
    // Adicionando o script do assistente virtual diretamente na renderização
    assistantScript: `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          document.getElementById('theme-toggle').addEventListener('click', function() {
            const html = document.documentElement;
            const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            this.innerHTML = newTheme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
          });

          const chatContainer = document.querySelector('.chat-container');
          const assistantToggle = document.getElementById('assistant-toggle');
          const closeChat = document.getElementById('close-chat');
          const chatMessages = document.getElementById('chat-messages');
          const chatInput = document.getElementById('chat-input');
          const sendMessage = document.getElementById('send-message');
          const assistantBtn = document.getElementById('assistant-btn');

          function toggleChat() {
            chatContainer.classList.toggle('open');
            assistantToggle.classList.toggle('btn-primary');
            assistantToggle.classList.toggle('btn-secondary');
          }

          if (assistantToggle) assistantToggle.addEventListener('click', toggleChat);
          if (closeChat) closeChat.addEventListener('click', toggleChat);
          if (assistantBtn) assistantBtn.addEventListener('click', function() {
            if (!chatContainer.classList.contains('open')) {
              toggleChat();
            }
          });

          const aiResponses = {
            "oi": "Olá! Sou o assistente virtual. Como posso te ajudar hoje?",
            "como funciona": "Este sistema permite enviar documentos .docx para correção e avaliação automática.",
            "formatos": "Atualmente aceitamos apenas arquivos no formato .docx (Word).",
            "correção": "O sistema analisa seu texto e fornece feedback sobre possíveis melhorias.",
            "limite": "Não há limite de tamanho, mas documentos muito grandes podem demorar mais para processar.",
            "privacy": "Seus documentos são processados apenas para correção e não são compartilhados.",
            "default": "Desculpe, não entendi. Posso ajudar com informações sobre: 'como funciona', 'formatos', 'correção', 'limite' ou 'privacy'."
          };

          function addMessage(isUser, message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`chat \${isUser ? 'chat-end' : 'chat-start'}\`;
            
            messageDiv.innerHTML = \`
              <div class="chat-image avatar">
                <div class="w-10 rounded-full \${isUser ? 'bg-accent' : 'bg-secondary'}">
                  <i class="fas \${isUser ? 'fa-user' : 'fa-robot'} m-auto text-lg"></i>
                </div>
              </div>
              <div class="chat-bubble \${isUser ? 'bg-accent text-accent-content' : 'bg-base-300 text-base-content'}">
                \${message}
              </div>
            \`;
            
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }

          function getAIResponse(message) {
            const lowerMsg = message.toLowerCase();
            let response = aiResponses.default;
            
            if (lowerMsg.includes('oi') || lowerMsg.includes('olá')) response = aiResponses.oi;
            else if (lowerMsg.includes('como funciona')) response = aiResponses["como funciona"];
            else if (lowerMsg.includes('formato')) response = aiResponses.formatos;
            else if (lowerMsg.includes('correção') || lowerMsg.includes('correcao')) response = aiResponses.correção;
            else if (lowerMsg.includes('limite')) response = aiResponses.limite;
            else if (lowerMsg.includes('privacidade')) response = aiResponses.privacy;
            
            setTimeout(() => {
              addMessage(false, response);
            }, 800);
          }

          if (sendMessage) {
            sendMessage.addEventListener('click', function() {
              const message = chatInput.value.trim();
              if (message) {
                addMessage(true, message);
                chatInput.value = '';
                getAIResponse(message);
              }
            });
          }

          if (chatInput) {
            chatInput.addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                sendMessage.click();
              }
            });
          }

          if (chatContainer) chatContainer.classList.remove('open');
        });
      </script>
    `
  });
});

// Upload do arquivo e redirecionamento
App.post("/upload", upload.single("document"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("Nenhum arquivo enviado.");
  }

  const filename = req.file.filename;
  const originalname = req.file.originalname;

  res.redirect(`/correcao?filename=${filename}&originalname=${originalname}`);
});

// Página de correção com leitura do DOCX e IA
App.get("/correcao", async (req, res) => {
  const { filename, originalname } = req.query;
  if (!filename || !originalname) {
    return res.redirect("/");
  }

  const filePath = path.join(uploadPath, filename);

  try {
    // Lê o arquivo .docx usando o mammoth
    const dataBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    const textoExtraido = result.value; // Conteúdo do DOCX extraído

    // Envia o texto para a IA, solicitando a correção e avaliação
    let saida = await IA.executar(textoExtraido);
    
    if (!saida) {
      saida = "Erro ao processar a IA.";
    }

    let chatComBold = saida.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Converte negrito marcado com **

    res.render("correcao", {
      filename,
      originalname,
      textoExtraido,
      chat: chatComBold,
      assistantScript: `
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            // Mesmo script do assistente virtual da página inicial
            document.getElementById('theme-toggle').addEventListener('click', function() {
              const html = document.documentElement;
              const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
              html.setAttribute('data-theme', newTheme);
              this.innerHTML = newTheme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
            });

            const chatContainer = document.querySelector('.chat-container');
            const assistantToggle = document.getElementById('assistant-toggle');
            const closeChat = document.getElementById('close-chat');
            const chatMessages = document.getElementById('chat-messages');
            const chatInput = document.getElementById('chat-input');
            const sendMessage = document.getElementById('send-message');
            const assistantBtn = document.getElementById('assistant-btn');

            function toggleChat() {
              chatContainer.classList.toggle('open');
              assistantToggle.classList.toggle('btn-primary');
              assistantToggle.classList.toggle('btn-secondary');
            }

            if (assistantToggle) assistantToggle.addEventListener('click', toggleChat);
            if (closeChat) closeChat.addEventListener('click', toggleChat);
            if (assistantBtn) assistantBtn.addEventListener('click', function() {
              if (!chatContainer.classList.contains('open')) {
                toggleChat();
              }
            });

            const aiResponses = {
              "oi": "Olá! Aqui você pode ver os resultados da correção do seu documento. Como posso te ajudar?",
              "resultados": "Os resultados mostram as correções sugeridas e avaliação do seu texto.",
              "download": "Você pode baixar o documento original clicando no botão de download.",
              "formatos": "Atualmente aceitamos apenas arquivos no formato .docx (Word).",
              "nova correção": "Para enviar outro documento, volte à página inicial e faça um novo upload.",
              "default": "Posso ajudar com: 'resultados', 'download', 'formatos' ou 'nova correção'."
            };

            function addMessage(isUser, message) {
              const messageDiv = document.createElement('div');
              messageDiv.className = \`chat \${isUser ? 'chat-end' : 'chat-start'}\`;
              
              messageDiv.innerHTML = \`
                <div class="chat-image avatar">
                  <div class="w-10 rounded-full \${isUser ? 'bg-accent' : 'bg-secondary'}">
                    <i class="fas \${isUser ? 'fa-user' : 'fa-robot'} m-auto text-lg"></i>
                  </div>
                </div>
                <div class="chat-bubble \${isUser ? 'bg-accent text-accent-content' : 'bg-base-300 text-base-content'}">
                  \${message}
                </div>
              \`;
              
              chatMessages.appendChild(messageDiv);
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            function getAIResponse(message) {
              const lowerMsg = message.toLowerCase();
              let response = aiResponses.default;
              
              if (lowerMsg.includes('oi') || lowerMsg.includes('olá')) response = aiResponses.oi;
              else if (lowerMsg.includes('resultado')) response = aiResponses.resultados;
              else if (lowerMsg.includes('download')) response = aiResponses.download;
              else if (lowerMsg.includes('formato')) response = aiResponses.formatos;
              else if (lowerMsg.includes('nova correção') || lowerMsg.includes('novo documento')) response = aiResponses["nova correção"];
              
              setTimeout(() => {
                addMessage(false, response);
              }, 800);
            }

            if (sendMessage) {
              sendMessage.addEventListener('click', function() {
                const message = chatInput.value.trim();
                if (message) {
                  addMessage(true, message);
                  chatInput.value = '';
                  getAIResponse(message);
                }
              });
            }

            if (chatInput) {
              chatInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                  sendMessage.click();
                }
              });
            }

            if (chatContainer) chatContainer.classList.remove('open');
          });
        </script>
      `
    });
  } catch (err) {
    console.error("Erro ao ler o DOCX:", err);
    res.status(500).send("Erro ao ler o conteúdo do DOCX.");
  }
});

// Iniciar o servidor
App.listen(3000, () => console.log("Aplicação No Ar"));