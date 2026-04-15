// src/index.js
// Archivo principal del bot de torneos

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require('discord.js');

const manager = require('./torneoManager');
const {
  embedRegistro,
  embedListo,
  embedJugadores,
  embedBrackets,
  embedGanador,
  embedNuevaRonda,
  botonesRegistro,
  botonesPartida,
  COLORES,
} = require('./embeds');

// ─────────────────────────────────────────
// CLIENTE
// ─────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

// ─────────────────────────────────────────
// READY
// ─────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  client.user.setActivity('🏆 /torneo crear', { type: 3 }); // WATCHING
});

// ─────────────────────────────────────────
// SLASH COMMANDS
// ─────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    await manejarComando(interaction);
  } else if (interaction.isButton()) {
    await manejarBoton(interaction);
  }
});

// ─────────────────────────────────────────
// MANEJADOR DE COMANDOS
// ─────────────────────────────────────────
async function manejarComando(interaction) {
  if (interaction.commandName !== 'torneo') return;

  const sub = interaction.options.getSubcommand();

  // ── /torneo crear ──────────────────────
  if (sub === 'crear') {
    const nombre = interaction.options.getString('nombre');
    const juego = interaction.options.getString('juego');
    const maxJugadores = interaction.options.getInteger('jugadores');
    const tipo = interaction.options.getString('tipo');

    const resultado = manager.crearTorneo({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      nombre,
      juego,
      maxJugadores,
      tipo,
      adminId: interaction.user.id,
    });

    if (resultado.error) {
      return interaction.reply({ content: resultado.error, ephemeral: true });
    }

    const { torneo } = resultado;
    const msg = await interaction.reply({
      embeds: [embedRegistro(torneo)],
      components: [botonesRegistro()],
      fetchReply: true,
    });

    // Guardar ID del mensaje para actualizarlo después
    torneo.messageId = msg.id;
    return;
  }

  // ── /torneo iniciar ────────────────────
  if (sub === 'iniciar') {
    const torneo = manager.obtenerTorneo(interaction.channelId);

    if (!torneo) {
      return interaction.reply({ content: '❌ No hay torneo activo en este canal.', ephemeral: true });
    }
    if (torneo.adminId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Solo el creador del torneo puede iniciarlo.', ephemeral: true });
    }

    const resultado = manager.iniciarTorneo(interaction.channelId);
    if (resultado.error) {
      return interaction.reply({ content: resultado.error, ephemeral: true });
    }

    const { torneo: t } = resultado;

    // Actualizar el mensaje de registro (ya no se puede unir)
    try {
      const msgOriginal = await interaction.channel.messages.fetch(t.messageId);
      await msgOriginal.edit({ components: [] }); // Quita los botones
    } catch {}

    // Mencionar a todos los jugadores
    const menciones = t.jugadores.map(j => `<@${j.id}>`).join(' ');

    await interaction.reply({
      content: `🚀 ${menciones}\n¡El torneo **${t.nombre}** ha comenzado!`,
    });

    // Enviar brackets con botones por partida
    const bracketMsg = await interaction.followUp({
      embeds: [embedBrackets(t)],
    });

    // Enviar botones de partida por separado (uno por partida activa)
    for (const partida of t.partidas.filter(p => !p.terminada)) {
      await interaction.followUp({
        content: `⚔️ **Partida ${partida.numero}:** ${partida.jugador1.displayName} vs ${partida.jugador2.displayName}`,
        components: [botonesPartida(partida.id)],
      });
    }
    return;
  }

  // ── /torneo cancelar ───────────────────
  if (sub === 'cancelar') {
    const torneo = manager.obtenerTorneo(interaction.channelId);

    if (!torneo) {
      return interaction.reply({ content: '❌ No hay torneo activo en este canal.', ephemeral: true });
    }
    if (torneo.adminId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Solo el creador del torneo puede cancelarlo.', ephemeral: true });
    }

    manager.cancelarTorneo(interaction.channelId);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚫 Torneo Cancelado')
          .setDescription(`El torneo **${torneo.nombre}** ha sido cancelado.`)
          .setColor(COLORES.rojo),
      ],
    });
  }

  // ── /torneo bracket ────────────────────
  if (sub === 'bracket') {
    const torneo = manager.obtenerTorneo(interaction.channelId);

    if (!torneo) {
      return interaction.reply({ content: '❌ No hay torneo activo en este canal.', ephemeral: true });
    }
    if (torneo.estado !== 'iniciado') {
      return interaction.reply({ content: '⚠️ El torneo aún no ha iniciado.', ephemeral: true });
    }

    return interaction.reply({ embeds: [embedBrackets(torneo)], ephemeral: true });
  }

  // ── /torneo jugadores ──────────────────
  if (sub === 'jugadores') {
    const torneo = manager.obtenerTorneo(interaction.channelId);

    if (!torneo) {
      return interaction.reply({ content: '❌ No hay torneo activo en este canal.', ephemeral: true });
    }

    return interaction.reply({ embeds: [embedJugadores(torneo)], ephemeral: true });
  }

  // ── /torneo historial ──────────────────
  if (sub === 'historial') {
    const historial = manager.obtenerHistorial(interaction.guildId);

    if (historial.length === 0) {
      return interaction.reply({ content: '📭 No hay torneos finalizados aún.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📚 Historial de Torneos')
      .setColor(COLORES.morado)
      .setDescription(
        historial.map((t, i) =>
          `**${i + 1}.** 🏆 **${t.nombre}** (${t.juego})\n` +
          `🥇 Ganador: **${t.ganador?.displayName || 'N/A'}** • ${t.jugadores.length} jugadores`
        ).join('\n\n')
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// ─────────────────────────────────────────
// MANEJADOR DE BOTONES
// ─────────────────────────────────────────
async function manejarBoton(interaction) {
  const id = interaction.customId;

  // ── Botón: Unirse ──────────────────────
  if (id === 'torneo_unirse') {
    const usuario = {
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.username,
    };

    const resultado = manager.unirse(interaction.channelId, usuario);

    if (resultado.error) {
      return interaction.reply({ content: resultado.error, ephemeral: true });
    }

    const { torneo } = resultado;

    // Actualizar el embed principal
    const estaLleno = torneo.jugadores.length >= torneo.maxJugadores;
    const embedActualizado = estaLleno ? embedListo(torneo) : embedRegistro(torneo);
    await interaction.update({ embeds: [embedActualizado], components: [botonesRegistro()] });

    // Notificación pública
    await interaction.followUp({
      content: resultado.mensaje,
      ephemeral: false,
    });
    return;
  }

  // ── Botón: Salir ───────────────────────
  if (id === 'torneo_salir') {
    const resultado = manager.salir(interaction.channelId, interaction.user.id);

    if (resultado.error) {
      return interaction.reply({ content: resultado.error, ephemeral: true });
    }

    const { torneo } = resultado;
    await interaction.update({ embeds: [embedRegistro(torneo)], components: [botonesRegistro()] });

    await interaction.followUp({
      content: resultado.mensaje,
      ephemeral: false,
    });
    return;
  }

  // ── Botón: Ver jugadores ───────────────
  if (id === 'torneo_jugadores') {
    const torneo = manager.obtenerTorneo(interaction.channelId);

    if (!torneo) {
      return interaction.reply({ content: '❌ No hay torneo activo.', ephemeral: true });
    }

    return interaction.reply({ embeds: [embedJugadores(torneo)], ephemeral: true });
  }

  // ── Botón: Gané (reportar ganador) ─────
  if (id.startsWith('torneo_gane_')) {
    const partidaId = id.replace('torneo_gane_', '');
    const torneo = manager.obtenerTorneo(interaction.channelId);

    if (!torneo) {
      return interaction.reply({ content: '❌ No hay torneo activo.', ephemeral: true });
    }

    const partida = torneo.partidas.find(p => p.id === partidaId);
    if (!partida) {
      return interaction.reply({ content: '❌ Partida no encontrada.', ephemeral: true });
    }

    // Verificar que es participante
    const esParticipante =
      partida.jugador1.id === interaction.user.id ||
      partida.jugador2?.id === interaction.user.id;

    if (!esParticipante) {
      return interaction.reply({
        content: '❌ Solo los participantes de esta partida pueden reportar el resultado.',
        ephemeral: true,
      });
    }

    if (partida.terminada) {
      return interaction.reply({
        content: `✅ Esta partida ya tiene ganador: **${partida.ganador?.displayName}**`,
        ephemeral: true,
      });
    }

    // Reportar ganador
    const resultado = manager.reportarGanador(
      interaction.channelId,
      partidaId,
      interaction.user.id,
    );

    if (resultado.error) {
      return interaction.reply({ content: resultado.error, ephemeral: true });
    }

    // Deshabilitar el botón de esta partida
    await interaction.update({ components: [] });

    const displayName = interaction.member?.displayName || interaction.user.username;

    // ── Torneo terminado ──
    if (resultado.torneoTerminado) {
      const menciones = resultado.torneo.jugadores.map(j => `<@${j.id}>`).join(' ');
      return interaction.followUp({
        content: menciones,
        embeds: [embedGanador(resultado.torneo)],
      });
    }

    // ── Nueva ronda ──
    if (resultado.nuevaRonda) {
      await interaction.followUp({
        content: `✅ **${displayName}** ganó la partida ${partidaId}.\n\n🔄 ¡Comenzando **Ronda ${resultado.ronda}**!`,
        embeds: [embedNuevaRonda(resultado.torneo)],
      });

      for (const p of resultado.torneo.partidas.filter(p => !p.terminada)) {
        await interaction.followUp({
          content: `⚔️ **Partida ${p.numero}:** ${p.jugador1.displayName} vs ${p.jugador2.displayName}`,
          components: [botonesPartida(p.id)],
        });
      }
      return;
    }

    // ── Resultado normal ──
    return interaction.followUp({
      content: `✅ **${displayName}** reportó su victoria en la partida **${partidaId}**.`,
      ephemeral: false,
    });
  }
}

// ─────────────────────────────────────────
// INICIAR BOT
// ─────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Falta DISCORD_TOKEN en el archivo .env');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
