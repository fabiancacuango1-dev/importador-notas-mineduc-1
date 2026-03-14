# Guía de Seguridad — Anti-Ingeniería Inversa

## Importador de Notas Mineduc — Distribución Comercial

---

## 1. Capas de Protección Implementadas

### Capa 1: Ofuscación de Código (webpack-obfuscator)
- **Control Flow Flattening**: Reorganiza la lógica en bloques switch/case, haciendo imposible seguir el flujo normal.
- **Dead Code Injection**: Inyecta código falso que nunca se ejecuta pero confunde al analista.
- **String Array Encoding (Base64 + RC4)**: Todas las cadenas se extraen a un array y se codifican.
- **Self-Defending**: El código detecta si fue formateado/beautificado y deja de funcionar.
- **Debug Protection**: Bloquea `debugger` y las herramientas de desarrollo cuando están abiertas.
- **Identifier Renaming (Hexadecimal)**: Variables se renombran a `_0x1a2b3c`.

### Capa 2: Minificación (Terser)
- Eliminación de comentarios, whitespace, dead code.
- Mangling de nombres internos con 2 pasadas.
- Sin source maps en producción.

### Capa 3: Empaquetado (Webpack)
- Módulos se empaquetan en bundles únicos que pierden la estructura original.
- Scope hoisting elimina los cierres de módulo.

### Capa 4: Verificación de Licencia por Servidor
- El plugin NO funciona sin validación exitosa contra el servidor.
- La lógica crítica (autorización para cargar notas) depende del estado devuelto por la API.
- Sin respuesta válida del servidor = extensión en modo trial limitado.

### Capa 5: Fingerprinting de Dispositivo
- SHA-256 de: UserAgent, idioma, resolución, GPU (WebGL), zona horaria, cores, memoria.
- El fingerprint se envía en cada validación de licencia.
- Si el fingerprint del dispositivo no coincide, la licencia se desactiva automáticamente.

### Capa 6: Integridad del Storage
- Se computa un hash (SHA-256) del estado de la licencia + fingerprint.
- Al iniciar, se verifica que el hash coincide.
- Si alguien manipula `chrome.storage.local` manualmente, la licencia se invalida.

### Capa 7: Heartbeat Periódico
- Cada 30 minutos (sesión activa) se revalida con el servidor.
- Cada 4 horas se hace una revalidación completa.
- Máximo 7 días offline antes de bloquear.
- Después de 3 intentos fallidos de validación → desactivación automática.

---

## 2. Flujo de Validación de Licencia

```
Usuario ejecuta Setup.exe
        │
        ▼
¿Ingresó código en el instalador?
   Sí → Se guarda en license_preactivation.json
   No → Modo trial
        │
        ▼
Extensión se carga en Chrome
        │
        ▼
LicenseGuard.initialize()
   ├── checkPreactivation() → Lee license_preactivation.json
   │      └── Si existe → FirebaseLicense.activateLicense(key)
   │
   ├── verifyStorageIntegrity()
   │      ├── ¿Firma SHA-256 coincide? → Continuar
   │      └── ¿No coincide? → deactivateLicense("tampered")
   │
   ├── validateWithServer(force=false)
   │      ├── Envía: license_key + teacher_id + fingerprint
   │      ├── Servidor valida contra KV
   │      └── Responde: { valid: true/false }
   │
   └── startHeartbeat()
          └── Revalida cada 30 min
```

---

## 3. Recomendaciones Adicionales para Máxima Protección

### No hacer (vulnerabilidades comunes):
- ❌ Nunca incluir source maps en producción.
- ❌ Nunca hardcodear claves admin o secretos en el código del cliente.
- ❌ No confiar solo en validación local — siempre verificar con servidor.
- ❌ No usar `eval()` para cargar código — los antivirus lo bloquean.

### Sí hacer (mejores prácticas):
- ✅ Mover toda lógica de negocio sensible al backend (Worker).
- ✅ Implementar rate limiting en la API de licencias.
- ✅ Rotar el `ADMIN_KEY` periódicamente en el Worker.
- ✅ Usar HTTPS para todas las comunicaciones API.
- ✅ Monitorear activaciones sospechosas (muchas desde el mismo IP/fingerprint).
- ✅ Implementar lista negra de licencias revocadas en el backend.

### Protección futura avanzada (opcional):
- **WASM**: Compilar la lógica de validación de licencia a WebAssembly.
- **Code Splitting temporal**: Cargar código crítico bajo demanda desde el servidor.
- **Certificate Pinning**: Verificar que la respuesta viene de tu servidor exacto.
- **Telemetría anti-piratería**: Reportar al servidor cuando se detecta manipulación.

---

## 4. Estructura de Seguridad del Backend (Worker)

```
POST /licenses/activate
  ├── Recibe: license_key, teacher_id, browser_fingerprint
  ├── Verifica: código existe en KV pool y no está usado
  ├── Vincula: código → teacher_id + fingerprint
  └── Responde: { success: true } + marca como usado

GET /licenses/validate
  ├── Recibe: license_key, teacher_id, browser_fingerprint
  ├── Verifica: código activado + teacher_id coincide + fingerprint coincide
  └── Responde: { valid: true/false }
```

### Reglas de seguridad del Worker:
- Las licencias se vinculan a un solo `teacher_id` + `browser_fingerprint`.
- Una vez activada, la licencia no puede reasignarse (a menos que admin intervenga).
- El endpoint `/licenses/generate` requiere `ADMIN_KEY`.
- CORS configurado para aceptar sólo orígenes válidos.

---

## 5. Proceso de Distribución Segura

1. **Desarrollar** en ramas privadas (código fuente nunca público).
2. **Build**: `npm run build:all` → ofusca, empaqueta y valida.
3. **Empaquetar**: Compilar `setup.iss` con Inno Setup → `Setup.exe`.
4. **Distribuir**: Subir `Setup.exe` a tu sitio web o compartir por canal seguro.
5. **Licenciar**: Generar códigos vía `/licenses/generate` y entregarlos al cliente.

El usuario final solo recibe:
- `Setup.exe` (ejecutable compilado por Inno Setup)
- Un código de licencia tipo `MINEDUC-XXXXXXXXXX`

Nunca recibe:
- Código fuente
- Archivos `.js` legibles
- Claves de API
- Acceso al backend
