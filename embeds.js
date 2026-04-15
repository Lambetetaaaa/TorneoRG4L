// src/embeds.js
// Constructores de embeds y botones para el bot de torneos

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ─────────────────────────────────────────
// COLORES
// ─────────────────────────────────────────
const COLORES = {
  oro: 0xFFD700,
  verde: 0x2ECC71,
  rojo: 0xE74C3C,
  azul: 0x3498DB,
  morado: 0x9B59B6,
  gris: 0x95A5A6,
};

// ─────────────────────────────────────────
// EMBED: REGISTRO DEL TORNEO
// ─────────────────────────────────────────
function embedRegistro(torneo) {
  const barra = barraProgreso(torneo.jugadores.length, torneo.maxJugadores);

  const embed = new EmbedBuilder()
    .setTitle(`🏆 TORNEO: ${torneo.nombre}`)
    .setColor(COLORES.oro)
    .setDescription(`> *¡Únete y demuestra tus habilidades!*`)
    .addFields(
      { name: '🎮 Juego', value: torneo.juego, inline: true },
      { name: '⚔️ Tipo', value: torneo.tipo, inline: true },
      { name: '📊 Estado', value: '🟢 Inscripciones abiertas', inline: true },
      {
        name: `👥 Jugadores (${torneo.jugadores.length}/${torneo.maxJugadores})`,
        value: barra,
        inline: false,
      },
    )
    .setFooter({ text: `Torneo ID: ${torneo.id} • Presiona un botón para interactuar` })
    .setTimestamp();

  return embed;
}

// ─────────────────────────────────────────
// EMBED: TORNEO LLENO / LISTO
// ─────────────────────────────────────────
function embedListo(torneo) {
  const embed = embedRegistro(torneo);
  embed
    .setColor(COLORES.morado)
    .spliceFields(2, 1, { name: '📊 Estado', value: '🟡 ¡Torneo lleno! Listo para iniciar', inline: true });
  return embed;
}

// ─────────────────────────────────────────
// EMBED: LISTA DE JUGADORES
// ─────────────────────────────────────────
function embedJugadores(torneo) {
  const lista = torneo.jugadores.length === 0
    ? '*Nadie se ha inscrito aún...*'
    : torneo.jugadores.map((j, i) => `\`${String(i + 1).padStart(2, '0')}.\` **${j.displayName}**`).join('\n');

  return new EmbedBuilder()
    .setTitle(`📋 Jugadores inscritos — ${torneo.nombre}`)
    .setColor(COLORES.azul)
    .setDescription(lista)
    .setFooter({ text: `${torneo.jugadores.length}/${torneo.maxJugadores} jugadores` })
    .setTimestamp();
}

// ─────────────────────────────────────────
// EMBED: BRACKETS / PARTIDAS
// ─────────────────────────────────────────
function embedBrackets(torneo) {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${torneo.nombre} — Ronda ${torneo.ronda}`)
    .setColor(COLORES.oro)
    .setDescription(`⚔️ ¡El torneo ha comenzado! Aquí están los enfrentamientos:`);

  for (const p of torneo.partidas) {
    const j2Nombre = p.jugador2 ? `**${p.jugador2.displayName}**` : '*BYE (pasa automáticamente)*';
    const estado = p.terminada
      ? `✅ Ganador: **${p.ganador?.displayName}**`
      : '⏳ En juego...';

    embed.addFields({
      name: `⚔️ Partida ${p.numero} [${p.id}]`,
      value: `**${p.jugador1.displayName}** vs ${j2Nombre}\n${estado}`,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Usa el botón 🏆 Gané en tu partida para reportar el resultado' });
  return embed;
}

// ─────────────────────────────────────────
// EMBED: GANADOR FINAL
// ─────────────────────────────────────────
function embedGanador(torneo) {
  return new EmbedBuilder()
    .setTitle('🏆 ¡TORNEO FINALIZADO!')
    .setColor(COLORES.oro)
    .setDescription(`## 🥇 ${torneo.ganador.displayName}\n\n*¡Felicitaciones al campeón de **${torneo.nombre}**!*`)
    .addFields(
      { name: '🎮 Juego', value: torneo.juego, inline: true },
      { name: '👥 Participantes', value: `${torneo.jugadores.length} jugadores`, inline: true },
    )
    .setTimestamp();
}

// ─────────────────────────────────────────
// EMBED: NUEVA RONDA
// ─────────────────────────────────────────
function embedNuevaRonda(torneo) {
  const embed = embedBrackets(torneo);
  embed.setDescription(`🔄 ¡**Ronda ${torneo.ronda}** en curso! Nuevos enfrentamientos:`);
  return embed;
}

// ─────────────────────────────────────────
// BOTONES: REGISTRO
// ─────────────────────────────────────────
function botonesRegistro() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('torneo_unirse')
      .setLabel('✅ Unirse')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('torneo_salir')
      .setLabel('❌ Salir')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('torneo_jugadores')
      .setLabel('📋 Ver jugadores')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ─────────────────────────────────────────
// BOTONES: PARTIDA (reportar ganador)
// ─────────────────────────────────────────
function botonesPartida(partidaId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`torneo_gane_${partidaId}`)
      .setLabel('🏆 Gané')
      .setStyle(ButtonStyle.Primary),
  );
}

// ─────────────────────────────────────────
// UTILIDAD: Barra de progreso
// ─────────────────────────────────────────
function barraProgreso(actual, maximo) {
  const llenos = Math.round((actual / maximo) * 10);
  const vacios = 10 - llenos;
  return `[${'█'.repeat(llenos)}${'░'.repeat(vacios)}] ${actual}/${maximo}`;
}

module.exports = {
  embedRegistro,
  embedListo,
  embedJugadores,
  embedBrackets,
  embedGanador,
  embedNuevaRonda,
  botonesRegistro,
  botonesPartida,
  COLORES,
};
