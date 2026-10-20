# CT-MED LIVE Studio — integração com o Command Center

O atalho **LIVE** do Command Center abre `/live/` em uma nova aba. O portal **não substitui** nem modifica a aplicação clínica: ele seleciona o endereço da central LIVE e abre os painéis de Editor, Maestro, Gil, Diego, Direção técnica, Tela pública e Aluno.

## Execução do LIVE Studio v1

O código-fonte completo está na pasta [`live-studio/`](../live-studio/) deste repositório. Baixe ou clone o projeto, instale Node.js 20+, entre na pasta `live-studio` e execute `iniciar-mac.command`, `iniciar-windows.bat` ou `LIVE_STUDIO_SECRET=UMA-SENHA-COM-12-CARACTERES npm start`. O ZIP da aplicação também está disponível na conversa de criação.

- Central no notebook: `http://127.0.0.1:8000/?view=maestro`.
- Tablets na mesma rede: `http://IP-DO-NOTEBOOK:8000/?view=gil` ou `?view=diego`.
- Operador de OBS: `?view=tecnica`.
- Tela projetada: `?view=publico`.
- Editor: `?view=editor`.

No portal `/live/`, altere o endereço do servidor em cada dispositivo conforme a rede utilizada. O ajuste fica salvo **somente naquele navegador**.

## Limites da versão local

O Command Center é estático, mas o LIVE Studio precisa de **servidor Node.js ativo** para manter estado, votações e roteiros sincronizados. A Vercel não executará automaticamente esse servidor só porque a pasta do portal foi publicada.

**Não expose a versão local diretamente à internet.** Para alunos votarem fora da LAN é necessário backend público com TLS, credenciais separadas, persistência e controles de abuso. As questões clínicas e respectivos gabaritos ainda exigem revisão técnica antes da transmissão.

## Divisão de responsabilidades

- Gil e Diego: um apresenta e controla o Maestro com passador/tablet; ambos consultam seus roteiros editáveis.
- Operador técnico: OBS, som, transmissão, chat e avisos. Não altera as decisões clínicas da simulação.

## Publicação

O projeto do Command Center na Vercel deve estar conectado ao repositório `gilkleber-design/ctmed-command-center`, raiz do projeto. O portal estático ficará acessível em `/live/` na próxima publicação que incluir este commit. Publicação depende das permissões da equipe Vercel.
