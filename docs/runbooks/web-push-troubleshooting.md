# Runbook — Web Push troubleshooting

Trigger: las notificaciones push del Approval Cockpit no llegan al
device del approver, o el endpoint `POST /push/test` devuelve `503` /
`failures`.

## Setup inicial (una vez por deployment)

1. **Generar VAPID keys** (sólo una vez por entorno; rotar opcional):
   ```bash
   node -e "console.log(require('web-push').generateVAPIDKeys())"
   ```
   Output:
   ```json
   { "publicKey": "BO…", "privateKey": "x…" }
   ```

2. **Configurar env vars** del server:
   ```bash
   VAPID_PUBLIC_KEY=BO…
   VAPID_PRIVATE_KEY=x…
   VAPID_SUBJECT=mailto:ops@bancamarch.es     # exigido por la spec Web Push
   ```
   `VAPID_SUBJECT` debe ser un `mailto:` o URL `https://` válido.

3. **Re-deploy server**. El sender re-configura `setVapidDetails` cuando
   detecta cambio de la public key.

4. **Cliente**: confirmar que el service worker (`/sw.js`) está
   registrado y que el cliente llama `GET /api/notifications/push/vapid-public-key`
   antes de `pushManager.subscribe`.

## Triage cuando push no llega

### 1. ¿Está VAPID configurado?
```bash
curl -s -H "x-entity-id: $ENTITY" $HOST/api/notifications/push/vapid-public-key
```
- `200` con `publicKey` → configurado.
- `503` `no_vapid_config` → faltan env vars. Volver al **Setup inicial**.

### 2. ¿Hay suscripciones registradas para el usuario?
```bash
curl -s -H "x-entity-id: $ENTITY" $HOST/api/notifications/push/subscriptions
```
- `items: []` → el usuario nunca clickó "Activar notificaciones" o el
  navegador rechazó el permiso. Pídele que abra `/approvals` y siga el
  flow `subscribeUserToPush` desde la UI.

### 3. ¿El test arroja delivered=0 con failures?
```bash
curl -s -X POST -H "x-entity-id: $ENTITY" \
     -H "content-type: application/json" \
     -d '{"message":"runbook test"}' \
     $HOST/api/notifications/push/test
```
Mirar el campo `failures`:

| `statusCode` | Significado | Acción |
|---|---|---|
| `410` | Suscripción inválida (Gone) | El sender ya purga staleEndpoints automáticamente. El usuario re-suscribe en su próxima visita. |
| `404` | Idem 410 | Idem. |
| `403` | VAPID auth fallida — keys mal configuradas | Verificar que `VAPID_SUBJECT` empieza con `mailto:` o `https://`. Re-generar keys si están corrompidas. |
| `413` | Payload too large | El payload del cockpit es chico (~200 B), si vemos esto es un bug — abrir issue. |
| `429` | Rate limit por el provider (FCM/APNS) | Esperar y reintentar. Considerar batching si la entity tiene >1000 suscripciones. |
| `500-503` | Provider transient error | Reintentar (no auto, manual desde `/push/test` o esperar a la próxima escalation). |

### 4. ¿Push entregado pero el navegador no muestra notif?

- El service worker (`/sw.js`) tiene que tener un handler `push`. Si no
  está, el navegador recibe el push pero lo descarta. Verificar:
  ```bash
  curl -s $HOST/sw.js | grep -A 5 "addEventListener.*push"
  ```
- Permisos del navegador: el usuario puede haber bloqueado las
  notificaciones a nivel sistema/sitio. En Chrome → site settings →
  Notifications → Allowed.

### 5. Notif duplicada
- El sender usa `tag: attribution-${decisionId}` para que el navegador
  deduplique. Si ves dos notifs idénticas, lo más probable es que el
  service worker no esté usando el tag al renderizar. Bug del SW.

## Acciones de emergencia

### Desactivar push globalmente (kill switch)
Borrar las env vars del server y restart. El endpoint devolverá `503`
y los workers harán `skipped='no_vapid'` sin intentar enviar.

### Purgar todas las suscripciones de un tenant
```sql
DELETE FROM push_subscriptions WHERE entity_id = :entity;
```
Útil tras incidente o para forzar re-suscripción masiva.

### Rotar VAPID keys
1. Generar nuevas (`node -e ...`).
2. Actualizar env vars del server. Re-deploy.
3. **Las suscripciones existentes siguen siendo válidas** — VAPID
   identifica al sender, no al device. El cliente no necesita re-suscribirse.

## Postmortem checklist

- ¿Cuántos usuarios estaban afectados? (`SELECT COUNT(DISTINCT user_email)
  FROM push_subscriptions WHERE entity_id=:entity;`)
- ¿Qué `statusCode` predominaba en `failures`?
- ¿El service worker estaba al día? (los SW se cachean — un bug viejo
  puede persistir días si no se invalida).
- ¿Hubo un cambio reciente de `VAPID_*`?

## Referencias

- Plan: `docs/ola-8-atribuciones-banca-march.md` Apéndice B Bloque C.
- Sender: `server/integrations/webPushSender.ts`.
- Dispatcher: `server/integrations/escalationPushDispatcher.ts`.
- Routes: `server/routes/notifications.ts`.
- W3C Web Push: https://www.w3.org/TR/push-api/
- VAPID spec: https://datatracker.ietf.org/doc/html/rfc8292
