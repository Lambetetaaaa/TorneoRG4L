// src/deploy-commands.js
// Ejecuta este script UNA VEZ para registrar los slash commands en Discord
// Uso: node src/deploy-commands.js

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./commands');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando slash commands...');

    // Para desarrollo: registrar en un servidor específico (instantáneo)
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`✅ Comandos registrados en el servidor ${process.env.GUILD_ID}`);
    } else {
      // Para producción: registrar globalmente (puede tardar hasta 1 hora)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('✅ Comandos registrados globalmente');
    }
  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
  }
})();
