# Express Mongo Initializer

Estrutura inicial de uma API Express com MongoDB, separada por responsabilidade.

## Fluxo de uma requisição

```text
Route -> Middleware -> Controller -> Manager -> Collection
                                  -> outro Manager
```

- **Routes** definem URL, verbo e a cadeia executada.
- **Middlewares** validam o contrato HTTP antes de chegar ao controller.
- **Controllers** leem `req`, chamam um manager, devolvem `res` e traduzem erros para HTTP.
- **Managers** concentram e orquestram as regras de negócio. Um manager pode usar outro manager especializado.
- **Collections** definem schemas e fazem a persistência no MongoDB.

No exemplo de produtos, `ProductManager` coordena o caso de uso e delega a normalização e validação do preço ao `ProductPricingManager`.

Na autenticação, `AuthManager` orquestra `PasswordManager` e `JwtManager`. Senhas são armazenadas com hash bcrypt, e o JWT assinado identifica o usuário pelo claim `sub`.

## Estrutura

```text
src/
  collections/
  config/
  controllers/
  enums/
  errors/
  managers/
  middlewares/
  routes/
test/
```

## Endpoints

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Cadastrar usuário e receber JWT |
| `POST` | `/api/auth/login` | Autenticar e receber JWT |
| `GET` | `/api/auth/me` | Consultar usuário autenticado |
| `POST` | `/api/product/create` | Criar produto |
| `GET` | `/api/product/search?name=...` | Buscar produtos |
| `PUT` | `/api/product/update/:id` | Atualizar produto |
| `DELETE` | `/api/product/delete/:id` | Excluir produto |

As rotas de produtos e `/api/auth/me` exigem o header:

```http
Authorization: Bearer SEU_TOKEN
```

## Execução

Crie o `.env` a partir de `.env.example` e execute:

```bash
npm install
npm run dev
```

Para validar os managers e middlewares sem acessar o banco:

```bash
npm test
```

## Swagger

Com o servidor em execução, acesse:

- Interface interativa: `http://localhost:3000/api-docs`
- Especificação OpenAPI JSON: `http://localhost:3000/api-docs.json`

Depois do login, clique em **Authorize** e informe somente o JWT. O Swagger UI adicionará automaticamente o prefixo `Bearer`.
