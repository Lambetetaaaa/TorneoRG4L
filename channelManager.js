// src/channelManager.js
// Gestiona la categoría y canales de partidas del torneo

const { ChannelType, PermissionFlagsBits } = require('discord.js');

class ChannelManager {
  /**
   * Crea la categoría principal del torneo y devuelve su ID.
   * Ejemplo: "🏆 TORNEO PVP - RONDA 1"
   */
  async crearCategoria(guild, nombreTorneo, ronda) {
    const categoria = await guild.channels.create({
      name: `🏆 ${nombreTorneo} — Ronda ${ronda}`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          // @everyone NO puede ver la categoría por defecto
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
    return categoria;
  }

  /**
   * Crea un canal de texto para una partida dentro de la categoría.
   * Solo los dos jugadores (y admins) pueden verlo.
   *
   * @param {Guild}  guild
   * @param {Channel} categoria  - La categoría padre
   * @param {object}  partida    - { id, numero, jugador1, jugador2 }
   * @param {string}  adminId    - ID del creador del torneo
   */
  async crearCanalPartida(guild, categoria, partida, adminId) {
    const j1 = partida.jugador1;
    const j2 = partida.jugador2;

    const nombreCanal = `⚔️-partida-${partida.numero}`;

    const permisosJugadores = [];

    // Permiso jugador 1
    permisosJugadores.push({
      id: j1.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });

    // Permiso jugador 2 (si no es BYE)
    if (j2) {
      permisosJugadores.push({
        id: j2.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    // Permiso admin del torneo
    permisosJugadores.push({
      id: adminId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });

    const canal = await guild.channels.create({
      name: nombreCanal,
      type: ChannelType.GuildText,
      parent: categoria.id,
      permissionOverwrites: [
        // Nadie puede ver por defecto
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        // Solo los jugadores y admin
        ...permisosJugadores,
      ],
    });

    return canal;
  }

  /**
   * Elimina todos los canales de texto dentro de una categoría,
   * luego elimina la categoría misma.
   *
   * @param {Guild}   guild
   * @param {string}  categoriaId
   */
  async eliminarCategoria(guild, categoriaId) {
    try {
      const categoria = await guild.channels.fetch(categoriaId);
      if (!categoria) return;

      // Eliminar todos los canales hijos
      const hijos = guild.channels.cache.filter(c => c.parentId === categoriaId);
      for (const [, canal] of hijos) {
        await canal.delete().catch(() => {});
      }

      // Eliminar la categoría
      await categoria.delete().catch(() => {});
    } catch (err) {
      console.error('Error eliminando categoría:', err.message);
    }
  }

  /**
   * Elimina un canal específico por ID.
   */
  async eliminarCanal(guild, canalId) {
    try {
      const canal = await guild.channels.fetch(canalId);
      if (canal) await canal.delete();
    } catch {}
  }
}

module.exports = new ChannelManager();
