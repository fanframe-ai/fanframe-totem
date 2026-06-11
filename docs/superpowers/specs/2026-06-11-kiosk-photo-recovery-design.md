# Recuperacao de foto por CPF

## Objetivo

Permitir que o cliente recupere no proprio totem uma foto concluida cujo QR Code nao foi escaneado.

## Fluxo

1. A home exibe `Recuperar minha foto` como acao secundaria.
2. O cliente informa o CPF completo usado no pagamento.
3. O backend autenticado pelo dispositivo procura pagamentos aprovados do mesmo totem nos ultimos 7 dias.
4. O cliente escolhe uma das fotos encontradas.
5. O backend cria um link temporario de 24 horas e o kiosk exibe novamente a foto e o QR Code.

## Protecoes

- A busca exige o segredo do dispositivo e nao funciona fora de um totem pareado.
- As fotos ficam restritas ao mesmo time e dispositivo onde foram compradas.
- Sao permitidas no maximo 10 buscas por dispositivo a cada 10 minutos.
- Os eventos registram somente os quatro ultimos digitos do CPF.
- Nenhuma rota publica permite pesquisar fotos por CPF.

## Escopo

O fluxo nao solicita PIN e nao envia fotos automaticamente por WhatsApp ou email.
