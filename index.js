// src/index.js
// Bot de Torneos — con canales automáticos por partida

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require('discord.js');

const manager       = require('./torneoManager');
const chanManager   = require('./channelManager');
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

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  client.user.setActivity('🏆 /torneo crear', { type: 3 });
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) await manejarComando(interaction);
  else if (interaction.isButton())       await manejarBoton(interaction);
});

// ══════════════════════════════════════════════════════════════
//  HELPER: Crear categoría + canales para la ronda actual
// ══════════════════════════════════════════════════════════════
async function crearCanalesRonda(guild, torneo) {
  const categoria = await chanManager.crearCategoria(guild, torneo.nombre, torneo.ronda);
  torneo.categoriaId = categoria.id;
  torneo.canalesPartida = {};

  for (const partida of torneo.partidas.filter(p => !p.terminada)) {
    const canal = await chanManager.crearCanalPartida(guild, categoria, partida, torneo.adminId);
    torneo.canalesPartida[partida.id] = canal.id;

    const j1 = partida.jugador1;
    const j2 = partida.jugador2;

    await canal.send({
      content: `<@${j1.id}> <@${j2.id}>`,
      embeds: [
        new EmbedBuilder()
          .setTitle(`⚔️ Partida ${partida.numero} — Ronda ${torneo.ronda}`)
          .setColor(COLORES.oro)
          .setDescription(
            `## ${j1.displayName}  vs  ${j2.displayName}\n\n` +
            `> 🎮 **Juego:** ${torneo.juego}\n` +
            `> ⚔️ **Tipo:** ${torneo.tipo}\n\n` +
            `Cuando terminen, el **ganador** presiona el botón de abajo.`
          )
          .setFooter({ text: `Torneo: ${torneo.nombre} • Solo los participantes pueden ver este canal` })
          .setTimestamp(),
      ],
      components: [botonesPartida(partida.id)],
    });
  }

  return categoria;
}

// ══════════════════════════════════════════════════════════════
//  HELPER: Avanzar ronda — borra categoría vieja, crea nueva
// ══════════════════════════════════════════════════════════════
async function avanzarRonda(guild, torneo, canalPrincipal, displayNameGanador, partidaId) {
  await canalPrincipal.send({
    content: `✅ **${displayNameGanador}** ganó la partida **${partidaId}**.`,
    embeds: [embedNuevaRonda(torneo)],
  });

  const categoriaAnteriorId = torneo.categoriaId;

  // Crear los nuevos canales de la siguiente ronda
  await crearCanalesRonda(guild, torneo);

  await canalPrincipal.send({
    content: `🔄 ¡**Ronda ${torneo.ronda}** iniciada! Los nuevos canales de partida fueron creados.`,
  });

  // Borrar categoría anterior 3 segundos después (para que los jugadores lean el resultado)
  if (categoriaAnteriorId) {
    setTimeout(() => chanManager.eliminarCategoria(guild, categoriaAnteriorId), 3000);
  }
}

// ══════════════════════════════════════════════════════════════
//  HELPER: Buscar torneo dado el canal donde se presionó un botón
//  (el botón puede estar en el canal de partida, no en el principal)
// ══════════════════════════════════════════════════════════════
function buscarTorneoPorCanal(channelId, partidaId) {
  // Intento directo (canal principal)
  const directa = manager.obtenerTorneo(channelId);
  if (directa) return directa;

  // Buscar en todos los torneos activos
  for (const [, torneo] of manager.torneos) {
    if (torneo.canalesPartida && torneo.canalesPartida[partidaId] === channelId) {
      return torneo;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
//  MANEJADOR DE COMANDOS
// ══════════════════════════════════════════════════════════════
async function manejarComando(interaction) {
  if (interaction.commandName !== 'torneo') return;
  const sub = interaction.options.getSubcommand();

  // ── /torneo crear ──────────────────────
  if (sub === 'crear') {
    const resultado = manager.crearTorneo({
      guildId:      interaction.guildId,
      channelId:    interaction.channelId,
      nombre:       interaction.options.getString('nombre'),
      juego:        interaction.options.getString('juego'),
      maxJugadores: interaction.options.getInteger('jugadores'),
      tipo:         interaction.options.getString('tipo'),
      adminId:      interaction.user.id,
    });

    if (resultado.error) return interaction.reply({ content: resultado.error, ephemeral: true });

    const { torneo } = resultado;
    const msg = await interaction.reply({
      embeds: [embedRegistro(torneo)],
      components: [botonesRegistro()],
      fetchReply: true,
    });
    torneo.messageId = msg.id;
    return;
  }

  // ── /torneo iniciar ────────────────────
  if (sub === 'iniciar') {
    const torneo = manager.obtenerTorneo(interaction.channelId);
    if (!torneo) return interaction.reply({ content: '❌ No hay torneo activo en este canal.', ephemeral: true });
    if (torneo.adminId !== interaction.user.id) return interaction.reply({ content: '❌ Solo el creador puede iniciarlo.', ephemeral: true });

    const resultado = manager.iniciarTorneo(interaction.channelId);
    if (resultado.error) return interaction.reply({ content: resultado.error, ephemeral: true });

    const { torneo: t } = resultado;
    const guild = interaction.guild;

    // Quitar botones del mensaje de registro
    try {
      const msgOriginal = await interaction.channel.messages.fetch(t.messageId);
      await msgOriginal.edit({ components: [] });
    } catch {}

    const menciones = t.jugadores.map(j => `<@${j.id}>`).join(' ');
    await interaction.reply({
      content: `🚀 ${menciones}\n¡**${t.nombre}** ha comenzado! Creando canales de partida...`,
    });

    // Enviar DM a cada jugador notificando el inicio
    for (const jugador of t.jugadores) {
      try {
        const miembro = await guild.members.fetch(jugador.id);
        await miembro.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🏆 ¡El torneo **${t.nombre}** ha comenzado!`)
              .setColor(COLORES.oro)
              .setDescription(
                `¡Hola **${jugador.displayName}**! El torneo en el que estás inscrito acaba de iniciar.\n\n` +
                `> 🎮 **Juego:** ${t.juego}\n` +
                `> ⚔️ **Tipo:** ${t.tipo}\n` +
                `> 👥 **Jugadores:** ${t.jugadores.length}\n\n` +
                `Revisa el servidor — se creó un canal privado para tu primera partida.`
              )
              .setFooter({ text: `¡Mucha suerte! 🍀` })
              .setTimestamp(),
          ],
        });
      } catch {
        // El usuario tiene DMs desactivados, ignorar silenciosamente
      }
    }

    await interaction.followUp({ embeds: [embedBrackets(t)] });

    // ✨ Crear categoría + canales
    try {
      await crearCanalesRonda(guild, t);
      await interaction.followUp({
        content: `✅ Canales creados en la categoría **🏆 ${t.nombre} — Ronda 1**.\n¡Cada jugador solo puede ver su canal!`,
      });
    } catch (err) {
      console.error('Error creando canales:', err);
      await interaction.followUp({
        content: `⚠️ Error al crear canales. Asegúrate de que el bot tenga el permiso **Gestionar Canales**.`,
        ephemeral: true,
      });
    }
    return;
  }

  // ── /torneo cancelar ───────────────────
  if (sub === 'cancelar') {
    const torneo = manager.obtenerTorneo(interaction.channelId);
    if (!torneo) return interaction.reply({ content: '❌ No hay torneo activo.', ephemeral: true });
    if (torneo.adminId !== interaction.user.id) return interaction.reply({ content: '❌ Solo el creador puede cancelarlo.', ephemeral: true });

    if (torneo.categoriaId) {
      await chanManager.eliminarCategoria(interaction.guild, torneo.categoriaId);
    }

    manager.cancelarTorneo(interaction.channelId);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚫 Torneo Cancelado')
          .setDescription(`El torneo **${torneo.nombre}** fue cancelado y sus canales eliminados.`)
          .setColor(COLORES.rojo),
      ],
    });
  }

  // ── /torneo bracket ────────────────────
  if (sub === 'bracket') {
    const torneo = manager.obtenerTorneo(interaction.channelId);
    if (!torneo) return interaction.reply({ content: '❌ No hay torneo activo.', ephemeral: true });
    if (torneo.estado !== 'iniciado') return interaction.reply({ content: '⚠️ El torneo aún no ha iniciado.', ephemeral: true });
    return interaction.reply({ embeds: [embedBrackets(torneo)], ephemeral: true });
  }

  // ── /torneo jugadores ──────────────────
  if (sub === 'jugadores') {
    const torneo = manager.obtenerTorneo(interaction.channelId);
    if (!torneo) return interaction.reply({ content: '❌ No hay torneo activo.', ephemeral: true });
    return interaction.reply({ embeds: [embedJugadores(torneo)], ephemeral: true });
  }

  // ── /torneo historial ──────────────────
  if (sub === 'historial') {
    const historial = manager.obtenerHistorial(interaction.guildId);
    if (historial.length === 0) return interaction.reply({ content: '📭 No hay torneos finalizados.', ephemeral: true });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📚 Historial de Torneos')
          .setColor(COLORES.morado)
          .setDescription(
            historial.map((t, i) =>
              `**${i + 1}.** 🏆 **${t.nombre}** (${t.juego})\n🥇 **${t.ganador?.displayName || 'N/A'}** • ${t.jugadores.length} jugadores`
            ).join('\n\n')
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  // ── /torneo descalificar ───────────────
  if (sub === 'descalificar') {
    const torneo = manager.obtenerTorneo(interaction.channelId);
    if (!torneo) return interaction.reply({ content: '❌ No hay torneo activo en este canal.', ephemeral: true });
    if (torneo.adminId !== interaction.user.id) return interaction.reply({ content: '❌ Solo el creador del torneo puede descalificar jugadores.', ephemeral: true });

    const usuarioTarget = interaction.options.getUser('jugador');
    const razon = interaction.options.getString('razon') || 'Sin razón especificada';

    // Verificar que el jugador está en el torneo
    const jugadorIdx = torneo.jugadores.findIndex(j => j.id === usuarioTarget.id);
    if (jugadorIdx === -1) return interaction.reply({ content: `❌ **${usuarioTarget.displayName || usuarioTarget.username}** no está inscrito en el torneo.`, ephemeral: true });

    const jugador = torneo.jugadores[jugadorIdx];

    if (torneo.estado === 'registro') {
      // Si el torneo no ha iniciado, simplemente eliminar al jugador
      torneo.jugadores.splice(jugadorIdx, 1);

      // Intentar DM al descalificado
      try {
        const miembro = await interaction.guild.members.fetch(usuarioTarget.id);
        await miembro.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🚫 Fuiste descalificado del torneo **${torneo.nombre}**`)
              .setColor(COLORES.rojo)
              .setDescription(`**Razón:** ${razon}`)
              .setTimestamp(),
          ],
        });
      } catch {}

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 Jugador Descalificado')
            .setColor(COLORES.rojo)
            .setDescription(`**${jugador.displayName}** fue descalificado del torneo.\n**Razón:** ${razon}`)
            .setTimestamp(),
        ],
      });
    }

    // Si el torneo ya inició: marcar sus partidas activas como walkover (el rival gana automáticamente)
    let partidasAfectadas = 0;
    for (const partida of torneo.partidas) {
      if (partida.terminada) continue;
      const esJ1 = partida.jugador1?.id === usuarioTarget.id;
      const esJ2 = partida.jugador2?.id === usuarioTarget.id;
      if (!esJ1 && !esJ2) continue;

      // El rival gana por walkover
      const ganadorWO = esJ1 ? partida.jugador2 : partida.jugador1;
      if (!ganadorWO) continue;

      const resultado = manager.reportarGanador(torneo.channelId, partida.id, ganadorWO.id);
      partidasAfectadas++;

      // Notificar en el canal de la partida si existe
      const canalPartidaId = torneo.canalesPartida?.[partida.id];
      if (canalPartidaId) {
        try {
          const canalPartida = await interaction.guild.channels.fetch(canalPartidaId);
          await canalPartida.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🚫 Walkover — Jugador Descalificado')
                .setColor(COLORES.rojo)
                .setDescription(
                  `**${jugador.displayName}** fue descalificado.\n` +
                  `**${ganadorWO.displayName}** avanza automáticamente.\n` +
                  `**Razón:** ${razon}`
                )
                .setTimestamp(),
            ],
          });
          setTimeout(() => chanManager.eliminarCanal(interaction.guild, canalPartidaId), 5000);
        } catch {}
      }

      // Procesar posibles cambios de ronda / fin de torneo
      if (resultado.torneoTerminado) {
        const menciones = resultado.torneo.jugadores.map(j => `<@${j.id}>`).join(' ');
        const canalPrincipal = await interaction.guild.channels.fetch(torneo.channelId).catch(() => null);
        if (canalPrincipal) {
          await canalPrincipal.send({ content: menciones, embeds: [embedGanador(resultado.torneo)] });
        }
        if (torneo.categoriaId) {
          setTimeout(() => chanManager.eliminarCategoria(interaction.guild, torneo.categoriaId), 10_000);
        }
      } else if (resultado.nuevaRonda) {
        const canalPrincipal = await interaction.guild.channels.fetch(torneo.channelId).catch(() => null);
        if (canalPrincipal) {
          await avanzarRonda(interaction.guild, resultado.torneo, canalPrincipal, ganadorWO.displayName, partida.id);
        }
      } else {
        const canalPrincipal = await interaction.guild.channels.fetch(torneo.channelId).catch(() => null);
        if (canalPrincipal) {
          await canalPrincipal.send({
            content: `✅ **${ganadorWO.displayName}** avanza por walkover (partida **${partida.id}**). Esperando los demás resultados...`,
          });
        }
      }
    }

    // Intentar DM al descalificado
    try {
      const miembro = await interaction.guild.members.fetch(usuarioTarget.id);
      await miembro.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🚫 Fuiste descalificado del torneo **${torneo.nombre}**`)
            .setColor(COLORES.rojo)
            .setDescription(`**Razón:** ${razon}`)
            .setTimestamp(),
        ],
      });
    } catch {}

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚫 Jugador Descalificado')
          .setColor(COLORES.rojo)
          .setDescription(
            `**${jugador.displayName}** fue descalificado del torneo.\n` +
            `**Razón:** ${razon}\n` +
            (partidasAfectadas > 0 ? `\n✅ ${partidasAfectadas} partida(s) resuelta(s) por walkover.` : '')
          )
          .setTimestamp(),
      ],
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  MANEJADOR DE BOTONES
// ══════════════════════════════════════════════════════════════
async function manejarBoton(interaction) {
  const id    = interaction.customId;
  const guild = interaction.guild;

  // ── Unirse ─────────────────────────────
  if (id === 'torneo_unirse') {
    const usuario = {
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.username,
    };
    const resultado = manager.unirse(interaction.channelId, usuario);
    if (resultado.error) return interaction.reply({ content: resultado.error, ephemeral: true });

    const { torneo } = resultado;
    const estaLleno = torneo.jugadores.length >= torneo.maxJugadores;
    await interaction.update({
      embeds: [estaLleno ? embedListo(torneo) : embedRegistro(torneo)],
      components: [botonesRegistro()],
    });
    await interaction.followUp({ content: resultado.mensaje });
    return;
  }

  // ── Salir ──────────────────────────────
  if (id === 'torneo_salir') {
    const resultado = manager.salir(interaction.channelId, interaction.user.id);
    if (resultado.error) return interaction.reply({ content: resultado.error, ephemeral: true });

    await interaction.update({
      embeds: [embedRegistro(resultado.torneo)],
      components: [botonesRegistro()],
    });
    await interaction.followUp({ content: resultado.mensaje });
    return;
  }

  // ── Ver jugadores ──────────────────────
  if (id === 'torneo_jugadores') {
    const torneo = manager.obtenerTorneo(interaction.channelId);
    if (!torneo) return interaction.reply({ content: '❌ No hay torneo activo.', ephemeral: true });
    return interaction.reply({ embeds: [embedJugadores(torneo)], ephemeral: true });
  }

  // ── 🏆 Gané ────────────────────────────
  if (id.startsWith('torneo_gane_')) {
    const partidaId = id.replace('torneo_gane_', '');
    const torneo = buscarTorneoPorCanal(interaction.channelId, partidaId);
    if (!torneo) return interaction.reply({ content: '❌ No se encontró el torneo de esta partida.', ephemeral: true });

    const partida = torneo.partidas.find(p => p.id === partidaId);
    if (!partida) return interaction.reply({ content: '❌ Partida no encontrada.', ephemeral: true });

    const esParticipante =
      partida.jugador1.id === interaction.user.id ||
      partida.jugador2?.id === interaction.user.id;

    if (!esParticipante) return interaction.reply({ content: '❌ Solo los participantes pueden reportar el resultado.', ephemeral: true });
    if (partida.terminada) return interaction.reply({ content: `✅ Ganador ya registrado: **${partida.ganador?.displayName}**`, ephemeral: true });

    const resultado = manager.reportarGanador(torneo.channelId, partidaId, interaction.user.id);
    if (resultado.error) return interaction.reply({ content: resultado.error, ephemeral: true });

    // Quitar botón
    await interaction.update({ components: [] });

    const displayName = interaction.member?.displayName || interaction.user.username;

    // Notificar en el canal de partida
    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ ¡Resultado registrado!')
          .setDescription(`🏆 **${displayName}** ganó esta partida.\nEste canal será eliminado en breve.`)
          .setColor(COLORES.verde),
      ],
    });

    // Obtener canal principal del torneo
    let canalPrincipal;
    try { canalPrincipal = await guild.channels.fetch(torneo.channelId); } catch {}

    // ── TORNEO TERMINADO ──────────────────
    if (resultado.torneoTerminado) {
      const menciones = resultado.torneo.jugadores.map(j => `<@${j.id}>`).join(' ');

      if (canalPrincipal) {
        await canalPrincipal.send({
          content: menciones,
          embeds: [embedGanador(resultado.torneo)],
        });
      }

      // Eliminar la categoría después de 10 segundos
      if (torneo.categoriaId) {
        setTimeout(() => chanManager.eliminarCategoria(guild, torneo.categoriaId), 10_000);
      }
      return;
    }

    // ── NUEVA RONDA ───────────────────────
    if (resultado.nuevaRonda) {
      if (canalPrincipal) {
        await avanzarRonda(guild, resultado.torneo, canalPrincipal, displayName, partidaId);
      }
      return;
    }

    // ── Resultado parcial (ronda no terminó aún) ──
    if (canalPrincipal) {
      await canalPrincipal.send({
        content: `✅ **${displayName}** ganó la partida **${partidaId}**. Esperando los demás resultados...`,
      });
    }

    // Borrar el canal de esta partida después de 5 segundos
    const canalPartidaId = torneo.canalesPartida?.[partidaId];
    if (canalPartidaId) {
      setTimeout(() => chanManager.eliminarCanal(guild, canalPartidaId), 5000);
    }
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
