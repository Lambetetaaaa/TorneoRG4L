# 🏆 Bot de Torneos para Discord

Bot completo para gestionar torneos con brackets, botones interactivos y embeds.

---

## 📋 Comandos disponibles

| Comando | Descripción | Quién puede usarlo |
|---|---|---|
| `/torneo crear` | Crea un torneo nuevo en el canal | Cualquier usuario |
| `/torneo iniciar` | Inicia el torneo y genera brackets | Solo el creador |
| `/torneo cancelar` | Cancela el torneo activo | Solo el creador |
| `/torneo bracket` | Muestra el estado del bracket | Cualquier usuario |
| `/torneo jugadores` | Lista los jugadores inscritos | Cualquier usuario |
| `/torneo historial` | Muestra torneos finalizados | Cualquier usuario |

---

## 🚀 Instalación paso a paso

### 1️⃣ Crear el bot en Discord

1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clic en **New Application** → ponle un nombre
3. Ve a **Bot** → clic en **Add Bot**
4. En **Privileged Gateway Intents** activa:
   - ✅ `SERVER MEMBERS INTENT`
   - ✅ `MESSAGE CONTENT INTENT`
5. Copia el **TOKEN** del bot

### 2️⃣ Obtener los IDs necesarios

- **CLIENT_ID**: En tu aplicación → pestaña *General Information* → `Application ID`
- **GUILD_ID** (para pruebas): Click derecho en tu servidor en Discord → `Copiar ID del servidor`
  (Debes tener **Modo Desarrollador** activado: Ajustes → Avanzado → Modo Desarrollador)

### 3️⃣ Invitar el bot a tu servidor

Genera el link de invitación en **OAuth2 → URL Generator**:
- Scope: `bot`, `applications.commands`
- Permisos: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`, `Manage Channels` (opcional para canales automáticos)

### 4️⃣ Configurar el proyecto

```bash
# Instalar dependencias
npm install

# Copiar el archivo de configuración
cp .env.example .env
```

Edita el archivo `.env`:
```env
DISCORD_TOKEN=tu_token_aqui
CLIENT_ID=tu_client_id_aqui
GUILD_ID=tu_guild_id_aqui   # Solo para desarrollo
```

### 5️⃣ Registrar los slash commands

```bash
node src/deploy-commands.js
```

> ✅ Solo necesitas hacer esto **una vez** o cuando cambies los comandos.

### 6️⃣ Iniciar el bot

```bash
npm start
```

---

## 🎮 Cómo usar el bot

### Crear un torneo
```
/torneo crear nombre:Torneo PvP juego:Minecraft jugadores:8 tipo:1v1
```

Aparecerá un mensaje con botones:
- **✅ Unirse** — Para inscribirse
- **❌ Salir** — Para retirarse
- **📋 Ver jugadores** — Lista los inscritos

### Iniciar el torneo
```
/torneo iniciar
```
El bot genera brackets automáticamente y menciona a todos los jugadores.

### Reportar ganador
En cada partida aparece el botón **🏆 Gané**.
Solo el participante puede presionarlo.

---

## 📁 Estructura del proyecto

```
torneo-bot/
├── src/
│   ├── index.js          # Archivo principal (eventos y lógica)
│   ├── torneoManager.js  # Gestión de torneos en memoria
│   ├── embeds.js         # Constructores de embeds y botones
│   ├── commands.js       # Definición de slash commands
│   └── deploy-commands.js # Script para registrar comandos
├── .env                  # Variables de entorno (no subir a git)
├── .env.example          # Plantilla de configuración
└── package.json
```

---

## 🔧 Personalización

### Cambiar colores de los embeds
En `src/embeds.js`, modifica el objeto `COLORES`:
```js
const COLORES = {
  oro: 0xFFD700,     // Color principal
  verde: 0x2ECC71,   // Unirse exitoso
  rojo: 0xE74C3C,    // Errores
  // ...
};
```

### Agregar persistencia (base de datos)
Por defecto los torneos se guardan en memoria (se pierden al reiniciar).
Para persistencia, puedes integrar:
- **SQLite** con `better-sqlite3` (sencillo, sin servidor)
- **MongoDB** con `mongoose` (para proyectos grandes)

Reemplaza el `Map` en `torneoManager.js` con llamadas a la BD.

---

## 💡 Notas importantes

- Los torneos se almacenan en **memoria RAM** → se borran al reiniciar el bot
- Cada torneo está vinculado a un canal específico
- Solo el creador del torneo puede iniciarlo o cancelarlo
- El bracket usa **eliminación directa** (single elimination)
- Si el número de jugadores es impar, uno pasa automáticamente (BYE)
