# CortsMe

Plataforma responsiva de sites, atendimento e agendamento para barbearias e salões, criada com Quasar/Vue, Express, MongoDB e Redis.

## Início rápido

```bash
docker compose up -d --build
```

- Aplicação: http://localhost:9000
- API: http://localhost:3000
- Saúde da API: http://localhost:3000/health
- Documentação Swagger herdada do inicializador: http://localhost:3000/api-docs

## Acessos iniciais

- Administrador: `admin@corts.me` / `CortsMe@2026!`
- Barbeiro de demonstração: `barber@corts.me` / `Barber@123`
- Site publicado de demonstração: http://localhost:9000/barbearia-premium

Clientes podem criar a própria conta em `/cadastro`. Por segurança, novos barbeiros só podem ser criados pelo administrador.

## Principais recursos

- Sessão JWT de 90 dias, RBAC `ADMIN`, `BARBER` e `USER`, senha com bcrypt e contatos cifrados com AES-256-GCM.
- Construtor de site com URL única, publicação, cores, banners, blocos, botões, rodapé, prévia responsiva e imagens armazenadas no MongoDB.
- Agenda visual responsiva, serviços, horários de funcionamento, pausas, prevenção de conflitos, agendamento manual e solicitações de ajuste.
- Bot isolado por barbearia, orientado a serviços, localização, dúvidas e conversão para agendamento, com logs paginados.
- CRUD administrativo paginado, busca, métricas e dados de toda a plataforma.
- Socket.IO para notificações em tempo real, webhooks de agenda e Redis para cache de sites públicos.

O login Google fica disponível ao preencher `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_APP_PASSWORD` no `.env` e integrar o botão com o Google Identity Services no domínio definitivo.
