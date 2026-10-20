# CT-MED LIVE Studio — SPRINT ISR

Aplicação funcional para criação e condução da live com três papéis: professores (Maestro e roteiros individuais), operador audiovisual (direção técnica), e participantes (tela pública/votação).

## Inicialização

Requer Node.js >= 20.

```bash
LIVE_STUDIO_SECRET='UMA-SENHA-FORTE-COM-12-CARACTERES' npm start
```

Acesse `http://localhost:8000/?view=editor`. Clique em **Acesso** e informe a senha definida em `LIVE_STUDIO_SECRET`.

Na rede local, abra `http://IP-DO-COMPUTADOR:8000/?view=gil`, `/diego`, `/maestro`, `/tecnica`, `/publico` ou `/aluno` em outros dispositivos. Computadores e tablets precisam estar na mesma rede e sem isolamento de clientes.

## Telas

- `?view=editor` — edição de casos, sinais vitais, falas, cues, votações, direções e objetivos; salva versão e backup.
- `?view=maestro` — comando do passador (`Espaço`/`→` avança; `←` retorna), fases por cena e votações.
- `?view=gil` e `?view=diego` — roteiros individuais sincronizados, com botão texto integral / cue.
- `?view=tecnica` — orientações para OBS, checklist local e avisos privados.
- `?view=publico` — conteúdo clínico projetado, sem gabarito antes da revelação.
- `?view=aluno` — votação por dispositivo.

## Estado e armazenamento

`data/lesson.json` contém o roteiro editável inicial com 5 pacientes (quatro blocos: pneumonia/choque; CAD; asma; EAP + BAVT). `data/runtime.json` persiste a sessão, o estado da votação e avanço. Backups anteriores são salvos como `data/backup-*.json` após editar.

## Segurança e hospedagem

A senha de produção limita ações de edição e direção, mas **a versão atual não possui sistema de contas nem infraestrutura apropriada para publicação aberta na internet**. Hospede apenas em rede local confiável, preferencialmente sem exposição pública. Votos usam IDs anônimos armazenados no navegador e não possuem autenticação forte nem mecanismo antifraude. Uso online com público externo exige uma camada autenticada e infraestrutura de eventos persistente com TLS, proteção de abuso e métricas.

OBS fica sob gestão de um terceiro operador: o passador altera apenas a apresentação clínica. Não há integração automática com OBS ou YouTube na versão 1.

## Integração com Command Center

Adicionar um botão `LIVE` no Command Center apontando para a URL do serviço hospedado (recomendado abrir em nova aba). A aplicação é independente para não alterar o Command Center sem acesso ao código-fonte atual.

## Validação clínica

Os cenários e respostas são um **primeiro rascunho pedagógico**, não protocolo clínico ou substituto de treinamento supervisionado. Revisar os parâmetros, as consequências e o conteúdo com os professores antes de 05/11/2026.

**Proteção:** a variável `LIVE_STUDIO_SECRET` agora é obrigatória e precisa ter pelo menos 12 caracteres. Não compartilhe essa senha com participantes; não hospede este servidor sem endurecer autenticação e acesso ao conteúdo.
