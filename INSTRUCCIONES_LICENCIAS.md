# 🔐 Sistema de Licencias — Importador de Notas Mineduc

## Instrucciones paso a paso

---

## 📁 Estructura del sistema de licencias

```
firebase.js           → Cliente REST de Firestore (ya existía)
licencias.js          → Verificación de licencias en Firestore
activacion.js         → Activación de licencias + botón WhatsApp
generarLicencias.js   → Script Node.js para generar y subir 1000 códigos
popup.html            → Interfaz del popup con compra y activación
popup.js              → Lógica del popup (conecta con content script)
content.js            → Orquestador principal (actualizado con bridge de mensajes)
```

---

## 🛠️ Paso 1: Configurar Firebase

### 1.1 Crear proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto (o usa el existente: `notas-academico`)
3. Habilita **Cloud Firestore** en modo producción

### 1.2 Obtener API Key (para la extensión)
1. En Firebase Console → ⚙️ Configuración del proyecto
2. Pestaña **General**
3. Copia la **Clave de API web (Web API Key)**
4. Abre `firebase.js` y reemplaza:
   ```js
   const API_KEY = "TU_API_KEY_AQUI";
   ```

### 1.3 Obtener clave de servicio (para el generador)
1. En Firebase Console → ⚙️ Configuración del proyecto
2. Pestaña **Cuentas de servicio**
3. Haz clic en **"Generar nueva clave privada"**
4. Guarda el archivo descargado como:
   ```
   serviceAccountKey.json
   ```
   en la **misma carpeta** del proyecto

> ⚠️ **IMPORTANTE**: Nunca subas `serviceAccountKey.json` a GitHub. Agrégalo a `.gitignore`.

---

## 📦 Paso 2: Instalar dependencias

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

Esto instalará:
- `firebase-admin` — SDK de Firebase para Node.js (generador de licencias)
- `jspdf` — Generador de PDF (ya existía)

---

## 🔑 Paso 3: Generar 1000 códigos de licencia

Ejecuta el siguiente comando:

```bash
node generarLicencias.js
```

Esto hará automáticamente:
1. ✅ Generará 1000 códigos únicos formato `MINEDUC-XXXXXXXXXXXX`
2. ✅ Creará la colección `licencias` en Firestore
3. ✅ Subirá los 1000 documentos con estado `"disponible"`
4. ✅ Guardará copia local en un archivo `.txt`

### Generar cantidad personalizada:
```bash
node generarLicencias.js 500    # Genera 500 códigos
node generarLicencias.js 2000   # Genera 2000 códigos
```

### Estructura de cada documento en Firestore:
| Campo              | Tipo   | Valor inicial     |
|--------------------|--------|-------------------|
| `codigo`           | string | `MINEDUC-A1B2C3...` |
| `estado`           | string | `"disponible"`     |
| `machine_id`       | string | `""` (vacío)       |
| `usuario`          | string | `""` (vacío)       |
| `fecha_activacion` | string | `""` (vacío)       |

---

## 🔒 Paso 4: Reglas de seguridad de Firestore

Ve a Firebase Console → Firestore → Reglas y configura:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /licencias/{licenciaId} {
      // Permitir lectura (para buscar códigos)
      allow read: if true;
      // Permitir escritura solo si el estado cambia de "disponible" a "activado"
      allow update: if resource.data.estado == "disponible"
                    && request.resource.data.estado == "activado";
      // No permitir crear ni borrar desde el cliente
      allow create, delete: if false;
    }
  }
}
```

---

## 🧩 Paso 5: Cargar la extensión en Chrome

1. Abre Chrome → `chrome://extensions/`
2. Activa **"Modo desarrollador"**
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta del proyecto

---

## 💡 Cómo funciona el sistema

### Flujo de compra:
1. El usuario abre el popup de la extensión
2. Hace clic en **"💬 Comprar por WhatsApp"**
3. Se abre WhatsApp con el mensaje: *"Quiero comprar el Importador de Notas Mineduc"*
4. El administrador recibe el mensaje, cobra el pago manualmente
5. El administrador envía un código del archivo `.txt` por WhatsApp

### Flujo de activación:
1. El usuario ingresa el código en el campo de licencia
2. La extensión se conecta a Firestore
3. Busca el código en la colección `licencias`
4. **Si no existe** → Muestra "Código de licencia no encontrado"
5. **Si ya fue usado en otra máquina** → Muestra "Esta licencia ya fue activada en otro dispositivo"
6. **Si ya fue usado en esta máquina** → Reactiva sin error
7. **Si está disponible** → Activa la licencia:
   - Guarda el `machine_id` (SHA-256 del navegador)
   - Cambia el estado a `"activado"`
   - Registra `usuario` y `fecha_activacion`
   - Habilita el modo Pro

### Seguridad:
- **Una licencia = una máquina**. Un código no puede funcionar en más de un dispositivo.
- El `machine_id` se genera con SHA-256 de propiedades del navegador (userAgent, resolución, timezone, etc.)
- Las reglas de Firestore impiden modificar licencias ya activadas desde el cliente.

---

## 📋 Resumen de archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `licencias.js` | **NUEVO** | Verificación de licencias en Firestore |
| `activacion.js` | **NUEVO** | Activación + vinculación de machine_id |
| `generarLicencias.js` | **NUEVO** | Script Node.js genera 1000 códigos y los sube a Firestore |
| `popup.html` | **ACTUALIZADO** | UI con botón WhatsApp + campo de licencia |
| `popup.js` | **ACTUALIZADO** | Lógica real de activación vía content script |
| `content.js` | **ACTUALIZADO** | Bridge de mensajes para activación desde popup |
| `manifest.json` | **ACTUALIZADO** | Incluye `licencias.js` y `activacion.js` |
| `package.json` | **ACTUALIZADO** | Dependencia `firebase-admin` para el generador |

---

## ❓ Solución de problemas

### "No se encontró serviceAccountKey.json"
→ Descarga la clave de servicio desde Firebase Console (ver Paso 1.3)

### "Error de conexión" al activar
→ Verifica que `API_KEY` en `firebase.js` sea correcta
→ Verifica que Firestore esté habilitado en tu proyecto

### "Sistema de licencias no disponible"
→ Asegúrate de estar en la página de Académico (https://academico.educarecuador.gob.ec)
→ Recarga la página

### La licencia se activa pero no persiste
→ Verifica que los permisos `"storage"` estén en `manifest.json`
