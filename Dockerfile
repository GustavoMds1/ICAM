# ---------------------------------------------------------------------------
# Imagem de produção da plataforma de investigação ICAM.
#
# Build em múltiplos estágios: a imagem final não contém código-fonte,
# ferramentas de build nem dependências de desenvolvimento.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS construcao
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# O catálogo é validado no build: catálogo inconsistente reprova a imagem.
RUN npx tsx scripts/validar-taxonomia.ts && npm run build

FROM node:22-alpine AS producao
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Usuário sem privilégios.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs icam

COPY --from=construcao --chown=icam:nodejs /app/.next/standalone ./
COPY --from=construcao --chown=icam:nodejs /app/.next/static ./.next/static
COPY --from=construcao --chown=icam:nodejs /app/public ./public
# Necessários em tempo de execução: catálogo, migrações e scripts de operação.
COPY --from=construcao --chown=icam:nodejs /app/data ./data
COPY --from=construcao --chown=icam:nodejs /app/db ./db
COPY --from=construcao --chown=icam:nodejs /app/scripts ./scripts
COPY --from=construcao --chown=icam:nodejs /app/node_modules/tsx ./node_modules/tsx

USER icam
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
