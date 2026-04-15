// src/commands.js
// Definición de todos los slash commands del bot

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [

  // ─────────────────────────────────────────
  // /torneo crear
  // ─────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('torneo')
    .setDescription('Comandos de torneos')
    .addSubcommand(sub =>
      sub
        .setName('crear')
        .setDescription('Crea un nuevo torneo en este canal')
        .addStringOption(opt =>
          opt.setName('nombre').setDescription('Nombre del torneo').setRequired(true))
        .addStringOption(opt =>
          opt.setName('juego').setDescription('Juego del torneo').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('jugadores')
            .setDescription('Máximo de jugadores (4-64)')
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(64))
        .addStringOption(opt =>
          opt.setName('tipo')
            .setDescription('Tipo de partida')
            .setRequired(true)
            .addChoices(
              { name: '1v1', value: '1v1' },
              { name: '2v2', value: '2v2' },
              { name: '3v3', value: '3v3' },
              { name: '4v4', value: '4v4' },
              { name: 'Battle Royale', value: 'Battle Royale' },
            )))

    // ─────────────────────────────────────────
    // /torneo iniciar
    // ─────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('iniciar')
        .setDescription('Inicia el torneo y genera los brackets'))

    // ─────────────────────────────────────────
    // /torneo cancelar
    // ─────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('cancelar')
        .setDescription('Cancela el torneo activo en este canal'))

    // ─────────────────────────────────────────
    // /torneo bracket
    // ─────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('bracket')
        .setDescription('Muestra el bracket actual del torneo'))

    // ─────────────────────────────────────────
    // /torneo jugadores
    // ─────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('jugadores')
        .setDescription('Lista todos los jugadores inscritos'))

    // ─────────────────────────────────────────
    // /torneo historial
    // ─────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('historial')
        .setDescription('Muestra los últimos torneos finalizados')),

].map(cmd => cmd.toJSON());

module.exports = commands;
