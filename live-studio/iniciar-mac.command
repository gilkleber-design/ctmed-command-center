#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 20+ não encontrado. Instale a versão LTS em https://nodejs.org/'
  read -r -p 'Pressione ENTER para fechar...'
  exit 1
fi
if [ -z "$LIVE_STUDIO_SECRET" ]; then
  read -r -s -p 'Crie/entre com a senha de controle desta execução: ' LIVE_STUDIO_SECRET
  echo
fi
if [ ${#LIVE_STUDIO_SECRET} -lt 12 ]; then echo 'Senha de controle deve ter ao menos 12 caracteres'; read -r -p 'ENTER para fechar' x; exit 1; fi
export LIVE_STUDIO_SECRET
node server.js
