# CT-MED LIVE · Construção colaborativa

## Entrada
Command Center → **LIVE Studio** → `/live/revisao.html`.

A mesma sessão autenticada no Supabase atende ao Command Center e à construção da LIVE. Gil pode cadastrar o segundo professor pela opção **Convidar Diego**; uma senha provisória forte é exibida apenas uma vez, e o aplicativo exige que Diego a troque no primeiro acesso.

## Fluxo editorial
1. Um item é criado com estado **Em discussão**, sem aprovação.
2. Ambos podem editar o conteúdo e comentar campos/trechos. Cada salvamento efetivo incrementa a revisão, guarda um evento com conteúdo antes/depois e invalida as duas aprovações da proposta.
3. Gil aprova **uma revisão específica**; Diego aprova **a mesma revisão** usando suas próprias credenciais.
4. Comentários abertos da revisão atual precisam ser resolvidos antes da aprovação.
5. A segunda aprovação fixa `final` e `final_revision`, bloqueando a edição direta.
6. **Reabrir para revisão** mantém a última versão definitiva e abre uma nova proposta ainda não aprovada.
7. Um caso totalmente excluído dispensa a aprovação de suas cenas dependentes para fins de publicação.
8. **Publicar versão aprovada** é habilitado quando todos os itens obrigatórios possuem consenso. A publicação recorta apenas snapshots `final`, nunca propostas, monta uma nova aula e atualiza o Maestro, sem ocorrer durante a sessão ao vivo.

## Conteúdo inicial
17 unidades propostas: pauta, abertura, seleção de quatro casos, dez cenas clínicas e encerramento. **Nenhuma dessas unidades recebe aprovação automática.** Os textos iniciais são sugestões pedagógicas em análise, não material clínico validado.

## Papéis
- `gil`: autor, pode aprovar como Gil e convidar Diego.
- `diego`: autor, pode aprovar como Diego.
- `operator`: comentários e avisos de direção técnica, sem aprovação clínica nem avanço de slides.
- `reviewer`: observação e comentários, sem aprovação.

## Banco
As tabelas `public.live_editorial_units`, `live_editorial_comments`, `live_editorial_events`, `live_editorial_release` têm RLS por autenticação de equipe; mutações passam pelas funções `live_editorial_action` e `live_editorial_publish` com travas transacionais e controle de revisão.

O Maestro anterior `/live/?view=maestro` está bloqueado até a primeira publicação validada. Clientes públicos não podem ler o roteiro editorial.

## Limites conhecidos
- A edição concorrente usa controle otimista: se dois autores tentarem salvar a mesma revisão, o segundo recebe aviso de conflito e deve reconciliar as alterações manualmente.
- O painel cobre decisões e texto; uma visualização gráfica completa do monitor/cenários para revisão ainda pode ser adicionada.
- Não substitui revisão científica dos casos e condutas antes da transmissão.
- O acesso de Diego depende da definição do endereço de e-mail dele no convite.


## IA — terceira participante (sob demanda)

A interface \`/live/revisao.html\` inclui um painel "IA · terceira participante", que responde no histórico do tópico como \`author_role=ia\` e propõe, quando justificado, até duas alterações de pauta. Sugestões aparecem na **coluna esquerda**, claramente marcadas como pendentes. Um professor precisa clicar **Aplicar como proposta** para efetivamente criar ou revisar um item; nenhuma sugestão da IA conta como aprovação.

- Modelo padrão: \`gpt-4.1-mini\`.
- Chamada exclusivamente manual pelo botão **Analisar com IA** ou **Revisar lacunas**.
- Entra: tópico atual reduzido, nomes/estado da pauta e até 5 comentários recentes. Não envia documentos completos ou todas as cenas.
- Sai: resposta sem preâmbulo ou concordância automática, até ~110 palavras; no máximo 2 sugestões estruturadas.
- Limite técnico: até 560 tokens de geração, até 900 caracteres por pergunta, no máximo 40 requisições por pessoa/dia e 80 requisições no projeto/dia.
- Observação: limite de requisições não equivale a teto monetário de API. Configure orçamento/alertas na OpenAI separadamente.
- Backend: Supabase Edge Function \`live-editorial-ai\` protegida por JWT da sessão e verificação de papel da equipe. Não exponha chaves no HTML, GitHub ou chat.
- Para ativar: Supabase → Edge Functions → Secrets → definir **\`OPENAI_API_KEY\`** usando chave própria da plataforma OpenAI. Até essa variável existir, a interface indica "Não configurada" e não tenta gerar respostas.
- Uma revisão médica feita pela IA é uma proposta; verificar diretrizes e recomendações antes de aplicar em material de ensino.
