# CT-MED LIVE — Roteiro operacional e Maestro (novembro/2026)

## Separação editorial (obrigatória)
- **Esqueleto pedagógico**: `/live/revisao.html`; fonte de consenso em `live_debate_sections`, `live_editorial_units`. NÃO editar essas tabelas por operações do roteiro.
- **Roteiro executável**: `/live/roteiro.html`; falas, slides, direção técnica e tempo em **nove blocos**. Cada bloco possui etapas ordenadas e revisão própria. Qualquer edição reinicia as aprovações do bloco.
- **Maestro**: `/live/maestro.html?view=maestro&preview=1` para prévia local, ou sem `preview=1` para versão publicada sincronizada.
- Painéis remotos: `?view=gil`, `?view=diego`, `?view=tecnica`.
- Tela de saída: `?view=tela` (apenas slide, para captura de janela no OBS; requer sessão autenticada). A rota `?view=publico` antiga **não** está sincronizada com este novo roteiro.

## Fluxo
1. Gil/Diego consultam o esqueleto fixado como referência na nova sala de roteiro.
2. Editam uma etapa por vez: título; slide (texto e/ou imagem); fala Gil; fala Diego; cue técnico; próxima ação; duração.
3. Salvam. Controle otimista por versão do bloco evita substituir alterações feitas pelo outro professor.
4. Cada professor aprova **a mesma revisão de cada bloco**. A aprovação exige slide e ao menos uma fala ou instrução técnica por etapa.
5. A prévia permite estudar e revisar sem afetar a publicação.
6. Quando todos os nove blocos estiverem aprovados, o botão `Publicar nova versão` libera uma cópia congelada no banco. A publicação não inicia a transmissão nem modifica as aprovações originais.
7. No Maestro publicado, quem usa o painel `view=maestro` avança as etapas; as demais visões acompanham o mesmo estado. `view=tela` exibe somente o slide.

## Backend (Supabase)
Projeto: `ctmed-command-center`.

Tabelas de roteiro (todas com RLS, leitura apenas para equipe Gil/Diego):
- `live_script_blocks`
- `live_script_steps`
- `live_script_releases`
- `live_script_runtime`

RPCs `SECURITY DEFINER` com autorização por `auth.uid()` e `live_editorial_role()`:
- `live_script_snapshot(p_preview boolean)`
- `live_script_action(p_action text, p_block_id text, p_step_id uuid, p_payload jsonb, p_expected_revision integer)`
- `live_script_publish()`
- `live_script_control(p_action text,p_index integer,p_mode text)`

A verificação de permissão ocorre no servidor; esconder botões no frontend não substitui autorização. Alterações são publicadas na `supabase_realtime`, com polling de contingência.

## Slides
Imagens PNG, JPEG e WebP até 10 MB, em bucket **privado** `ctmed-live-slides`. O arquivo é salvo em `sprint-isr/<uuid>-<nome>`, e o roteiro guarda somente `slide_asset_path`. A tela resolve o arquivo com `createSignedUrl` da sessão autorizada, por tempo limitado. Slides já referenciados por uma publicação não são apagados quando a etapa é editada. Para PPTX/PDF, exportar cada slide como imagem 16:9 antes de anexar.

## Segurança e limites
- Sem publicação automática do esqueleto.
- Sem aprovação automática de conteúdo novo. Todos os blocos começam como rascunho.
- O controle de votação dos alunos no LIVE legado **ainda não foi integrado** à linha do tempo deste Maestro.
- Para projetar com OBS, capture a janela autenticada do modo Tela; o Browser Source do OBS não compartilha automaticamente a sessão do navegador.
