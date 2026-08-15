# Financeiro CortsMe com InfinitePay

## Escopo

O CortsMe vende ciclos de acesso de 30 dias por pagamentos avulsos à vista. A integração usa o Checkout Integrado público da InfinitePay: criação de link, retorno ao sistema, webhook de pagamento aprovado e confirmação server-to-server com `payment_check`.

Não há renovação automática de cartão neste fluxo. Cada renovação gera um novo pedido e um novo link de checkout.

## Configuração mínima

O catálogo de planos só pode ser exibido ao barbeiro quando o administrador tiver configurado:

- InfiniteTag/handle válido, salvo sem o caractere `$`;
- URL HTTPS pública do webhook;
- URL de retorno ao financeiro do barbeiro;
- ao menos um plano pago ativo.

Enquanto esses requisitos não forem atendidos, a API não cria checkouts e o painel profissional mostra apenas a indisponibilidade da contratação.

## Planos

- No máximo cinco planos configuráveis.
- Exatamente um plano gratuito de referência.
- Preços persistidos em centavos.
- Nome, código, descrição, vantagens, ordem e disponibilidade editáveis.
- As vantagens são informativas e preparadas para futuras permissões.
- As permissões efetivas usadas agora são: publicar site, confirmar agendamentos e usar o bot.

## Regras de acesso

| Situação | Site publicado | Visualizar serviços/horários | Confirmar agendamento | Conversar com bot |
| --- | --- | --- | --- | --- |
| Gratuito | Sim | Sim | Não | Não, mas o recurso permanece visível e explica o bloqueio |
| Pago e ativo | Sim | Sim | Sim | Sim |
| Pago, faltando até 7 dias | Sim | Sim | Sim | Sim |
| Expirado ou suspenso | Sim | Sim | Não | Não, com mensagem de renovação |
| Renovação pendente com ciclo anterior válido | Sim | Sim | Sim | Sim |

Uma suspensão nunca apaga site, agenda, clientes, conteúdo ou histórico financeiro.

## Fluxo de compra

1. O barbeiro abre **Financeiro**.
2. A API confirma que a configuração administrativa está pronta.
3. O barbeiro escolhe um plano pago.
4. O backend cria um `Payment` pendente com preço e plano congelados em snapshot.
5. O backend envia à InfinitePay `handle`, `order_nsu`, `items`, `customer`, `redirect_url` e `webhook_url`.
6. O navegador abre a URL de checkout retornada pela InfinitePay.
7. Após o pagamento, a InfinitePay chama o webhook e o cliente pode retornar ao financeiro.
8. O backend localiza o pedido por `order_nsu`, confere valor e unicidade de `transaction_nsu` e consulta `payment_check`.
9. Somente com `success=true`, `paid=true` e valor compatível o pagamento vira `PAID`.
10. O plano é ativado e o ciclo é estendido por 30 dias a partir da maior data entre agora e o vencimento atual.

## Webhook e idempotência

O webhook público não depende de assinatura HMAC porque esse mecanismo não está documentado na API pública usada. A segurança é baseada em:

- `order_nsu` imprevisível e único;
- pedido previamente persistido;
- preço congelado no pedido;
- `transaction_nsu` único;
- confirmação direta no endpoint oficial `payment_check`;
- processamento idempotente de reenvios;
- registro de todos os eventos recebidos;
- resposta `400` para pedido inexistente ou confirmação inválida, permitindo nova tentativa da InfinitePay.

## Estados

- `FREE`: plano gratuito, sem vencimento.
- `PENDING`: checkout criado, aguardando pagamento.
- `ACTIVE`: ciclo pago válido.
- `EXPIRED`: vencimento ultrapassado.
- `SUSPENDED`: acesso premium bloqueado administrativamente ou por inadimplência.
- `CANCELED`: assinatura encerrada, sem apagar dados.

O frontend deriva o aviso `EXPIRING` quando restam de zero a sete dias.

## Experiência por perfil

### Administrador

- configura InfiniteTag, webhook e retorno;
- cria e edita até cinco planos;
- acompanha todas as assinaturas e pagamentos com paginação;
- filtra por plano e situação;
- ajusta plano, estado e vencimento de uma assinatura;
- pode simular uma aprovação somente quando o ambiente habilita explicitamente essa função de teste.

### Barbeiro

- vê plano atual e badge em seu layout;
- acompanha vencimento e histórico de pagamentos;
- recebe contagem regressiva nos sete dias finais;
- recebe aviso de suspensão após expirar;
- renova escolhendo um plano e seguindo para o checkout hospedado.

### Cliente público

- continua acessando o site e visualizando serviços e horários;
- em plano gratuito/expirado, o botão de confirmação explica que o recurso não está disponível;
- o bot permanece visível como demonstração, mas explica que o profissional precisa ativar um plano.

## Testes locais com ngrok

O ngrok deve encaminhar uma URL HTTPS pública para `http://localhost:3000`. O valor cadastrado no admin deve terminar em:

```text
/api/billing/infinitepay/webhook
```

O health check público pelo mesmo túnel deve responder antes de gerar um checkout. Uma URL gratuita do ngrok pode mudar a cada reinicialização e, nesse caso, deve ser atualizada no financeiro administrativo.
